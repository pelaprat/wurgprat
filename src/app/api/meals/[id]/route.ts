import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { createMealCalendarEvent, updateMealCalendarEvent, updateMealCalendarEventDateTime } from "@/lib/google";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user's household
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Verify the meal belongs to a weekly plan in the user's household
  const { data: meal, error: mealError } = await supabase
    .from("meals")
    .select(`
      id,
      weekly_plan:weekly_plan_id (
        household_id
      )
    `)
    .eq("id", params.id)
    .single();

  if (mealError || !meal) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weeklyPlan = meal.weekly_plan as any;
  if (weeklyPlan?.household_id !== user.household_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { assigned_user_id, day } = body;

  // Validate day if provided
  if (day !== undefined && (typeof day !== "number" || day < 1 || day > 7)) {
    return NextResponse.json({ error: "Day must be a number between 1 and 7" }, { status: 400 });
  }

  // Get the current meal data before update (needed for calendar sync)
  const { data: currentMeal } = await supabase
    .from("meals")
    .select(`
      id,
      day,
      meal_type,
      calendar_event_id,
      custom_meal_name,
      recipe_id,
      recipes (name),
      weekly_plan:weekly_plan_id (
        household_id,
        week_of
      )
    `)
    .eq("id", params.id)
    .single();

  // Build update object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (assigned_user_id !== undefined) {
    updateData.assigned_user_id = assigned_user_id || null;
  }
  if (day !== undefined) {
    updateData.day = day;
  }

  // Update the meal
  const { data: updatedMeal, error: updateError } = await supabase
    .from("meals")
    .update(updateData)
    .eq("id", params.id)
    .select(`
      id,
      day,
      assigned_user_id,
      assigned_user:users!meals_assigned_user_id_fkey (
        id,
        name,
        email
      )
    `)
    .single();

  if (updateError) {
    console.error("Failed to update meal:", updateError);
    return NextResponse.json(
      { error: "Failed to update meal" },
      { status: 500 }
    );
  }

  // Sync to Google Calendar
  let calendarSynced = false;
  if (currentMeal) {
    const accessToken = session.accessToken as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weeklyPlanData = currentMeal.weekly_plan as any;
    const householdId = weeklyPlanData?.household_id;

    if (accessToken && householdId) {
      // Get household calendar settings
      const { data: household } = await supabase
        .from("households")
        .select("settings")
        .eq("id", householdId)
        .single();

      const calendarId = household?.settings?.google_calendar_id;
      const timezone = household?.settings?.timezone || "America/New_York";

      if (calendarId) {
        // Helper to calculate date string from week_of + day offset (using local date to avoid UTC shift)
        const calculateDateForDay = (weekOf: string, dayNum: number): string => {
          const weekOfDate = new Date(weekOf + "T00:00:00");
          weekOfDate.setDate(weekOfDate.getDate() + (dayNum - 1));
          const year = weekOfDate.getFullYear();
          const month = String(weekOfDate.getMonth() + 1).padStart(2, "0");
          const d = String(weekOfDate.getDate()).padStart(2, "0");
          return `${year}-${month}-${d}`;
        };

        try {
          if (currentMeal.calendar_event_id) {
            // Meal already has a calendar event — update it
            if (day !== undefined && day !== currentMeal.day && weeklyPlanData?.week_of) {
              const newDate = calculateDateForDay(weeklyPlanData.week_of, day);
              await updateMealCalendarEventDateTime(accessToken, calendarId, currentMeal.calendar_event_id, {
                newDate,
                mealType: currentMeal.meal_type || "dinner",
                timezone,
              });
              calendarSynced = true;
            }

            // If assigned user changed, update the event title
            if (assigned_user_id !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const recipeName = (currentMeal.recipes as any)?.name;
              const mealName = recipeName || currentMeal.custom_meal_name || "Dinner";
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const assignedUser = updatedMeal.assigned_user as any;
              const assignedUserName = assignedUser?.name;

              await updateMealCalendarEvent(accessToken, calendarId, currentMeal.calendar_event_id, {
                mealId: params.id,
                mealName,
                mealType: currentMeal.meal_type || "dinner",
                assignedUserName,
              });
              calendarSynced = true;
            }
          } else if (day !== undefined && day !== currentMeal.day && weeklyPlanData?.week_of) {
            // Meal has no calendar event yet — create one on the new day
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const recipeName = (currentMeal.recipes as any)?.name;
            const mealName = recipeName || currentMeal.custom_meal_name || "Dinner";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assignedUser = updatedMeal.assigned_user as any;
            const assignedUserName = assignedUser?.name;
            const newDate = calculateDateForDay(weeklyPlanData.week_of, day);

            const eventId = await createMealCalendarEvent(accessToken, calendarId, {
              mealId: params.id,
              date: newDate,
              mealType: currentMeal.meal_type || "dinner",
              mealName,
              assignedUserName,
              timezone,
            });

            if (eventId) {
              await supabase
                .from("meals")
                .update({ calendar_event_id: eventId })
                .eq("id", params.id);
              calendarSynced = true;
            }
          }
        } catch (error) {
          console.error("Failed to sync meal to Google Calendar:", error);
          // Don't fail the response, calendar sync is secondary
        }
      }
    }
  } else {
    console.error("Failed to fetch current meal data for calendar sync, meal id:", params.id);
  }

  return NextResponse.json({ meal: updatedMeal, calendarSynced });
}
