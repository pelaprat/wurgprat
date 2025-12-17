import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { updateMealCalendarEvent } from "@/lib/google";

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
  const { assigned_user_id } = body;

  // Get the current meal data before update (needed for calendar sync)
  const { data: currentMeal } = await supabase
    .from("meals")
    .select(`
      id,
      meal_type,
      calendar_event_id,
      custom_meal_name,
      recipe_id,
      recipes (name),
      weekly_plan:weekly_plan_id (
        household_id
      )
    `)
    .eq("id", params.id)
    .single();

  // Update the meal
  const { data: updatedMeal, error: updateError } = await supabase
    .from("meals")
    .update({
      assigned_user_id: assigned_user_id || null,
    })
    .eq("id", params.id)
    .select(`
      id,
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

  // Sync to Google Calendar if calendar event exists
  if (currentMeal?.calendar_event_id) {
    const accessToken = session.accessToken as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const householdId = (currentMeal.weekly_plan as any)?.household_id;

    if (accessToken && householdId) {
      // Get household calendar settings
      const { data: household } = await supabase
        .from("households")
        .select("settings")
        .eq("id", householdId)
        .single();

      const calendarId = household?.settings?.google_calendar_id;

      if (calendarId) {
        // Get the meal name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recipeName = (currentMeal.recipes as any)?.name;
        const mealName = recipeName || currentMeal.custom_meal_name || "Dinner";

        // Get the new assigned user name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assignedUser = updatedMeal.assigned_user as any;
        const assignedUserName = assignedUser?.name;

        try {
          await updateMealCalendarEvent(accessToken, calendarId, currentMeal.calendar_event_id, {
            mealId: params.id,
            mealName,
            mealType: currentMeal.meal_type || "dinner",
            assignedUserName,
          });
        } catch (error) {
          console.error("Failed to sync meal to Google Calendar:", error);
          // Don't fail the response, calendar sync is secondary
        }
      }
    }
  }

  return NextResponse.json({ meal: updatedMeal });
}
