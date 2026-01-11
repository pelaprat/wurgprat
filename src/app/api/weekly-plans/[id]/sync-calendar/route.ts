import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { createMealCalendarEvent } from "@/lib/google";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.accessToken as string | undefined;
  console.log("[sync-calendar] Access token check:", {
    hasAccessToken: !!accessToken,
    tokenLength: accessToken?.length,
    tokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : null,
  });

  if (!accessToken) {
    return NextResponse.json(
      { error: "No access token. Please sign out and sign back in." },
      { status: 401 }
    );
  }

  // Debug: Check token info to see what scopes it has
  try {
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    );
    const tokenInfo = await tokenInfoResponse.json();
    console.log("[sync-calendar] Token info:", {
      scope: tokenInfo.scope,
      email: tokenInfo.email,
      error: tokenInfo.error,
      error_description: tokenInfo.error_description,
    });
  } catch (e) {
    console.log("[sync-calendar] Failed to get token info:", e);
  }

  const supabase = getServiceSupabase();

  // Get user's household
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Get household settings
  const { data: household } = await supabase
    .from("households")
    .select("settings, timezone")
    .eq("id", user.household_id)
    .single();

  const calendarId = household?.settings?.google_calendar_id;
  if (!calendarId) {
    return NextResponse.json(
      { error: "No calendar configured. Please select a calendar in Settings first." },
      { status: 400 }
    );
  }

  const timezone = household?.timezone || "America/New_York";

  // Get the weekly plan with meals
  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plan")
    .select(`
      id,
      week_of,
      household_id,
      meals (
        id,
        day,
        meal_type,
        recipe_id,
        custom_meal_name,
        assigned_user_id,
        calendar_event_id
      )
    `)
    .eq("id", id)
    .eq("household_id", user.household_id)
    .single();

  console.log("[sync-calendar] Query result:", {
    planId: id,
    weeklyPlanId: weeklyPlan?.id,
    mealsCount: weeklyPlan?.meals?.length ?? 0,
    planError: planError?.message,
    meals: weeklyPlan?.meals,
  });

  // Query meals directly - more reliable than relational query
  const { data: directMeals, error: directMealsError } = await supabase
    .from("meals")
    .select("id, day, meal_type, recipe_id, custom_meal_name, calendar_event_id")
    .eq("weekly_plan_id", id);

  console.log("[sync-calendar] Direct meals query:", {
    directMealsCount: directMeals?.length ?? 0,
    directMealsError: directMealsError?.message,
    directMeals,
  });

  // Use direct meals query as primary source (more reliable than relational query)
  // This ensures we get meals even if Supabase relationship inference has issues
  const mealsToProcess = directMeals || [];

  // Get recipe names for meals that have recipes
  const recipeIds = mealsToProcess
    .filter((m) => m.recipe_id)
    .map((m) => m.recipe_id as string);

  let recipeNames: Record<string, string> = {};
  if (recipeIds.length > 0) {
    const { data: recipes } = await supabase
      .from("recipes")
      .select("id, name")
      .in("id", recipeIds);

    recipeNames = (recipes || []).reduce((acc: Record<string, string>, r: { id: string; name: string }) => {
      acc[r.id] = r.name;
      return acc;
    }, {});
  }

  if (planError || !weeklyPlan) {
    return NextResponse.json({ error: "Weekly plan not found" }, { status: 404 });
  }

  // Get user names for assigned users (need to get from direct query with assigned_user_id)
  // Since our direct query doesn't include assigned_user_id, fetch it now
  const { data: mealsWithAssignees } = await supabase
    .from("meals")
    .select("id, assigned_user_id")
    .eq("weekly_plan_id", id);

  const assigneeMap = new Map<string, string | null>();
  (mealsWithAssignees || []).forEach(m => {
    assigneeMap.set(m.id, m.assigned_user_id);
  });

  const assignedUserIds = Array.from(new Set(
    (mealsWithAssignees || [])
      .filter((m) => m.assigned_user_id)
      .map((m) => m.assigned_user_id as string)
  ));

  let userNames: Record<string, string> = {};
  if (assignedUserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", assignedUserIds);

    userNames = (users || []).reduce((acc: Record<string, string>, u: { id: string; name: string }) => {
      acc[u.id] = u.name || "Unknown";
      return acc;
    }, {});
  }

  // Calculate dates for each day
  const weekOfDate = new Date(weeklyPlan.week_of + "T00:00:00");
  const getDayDate = (day: number): string => {
    const date = new Date(weekOfDate);
    date.setDate(weekOfDate.getDate() + (day - 1));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayNum = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${dayNum}`;
  };

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process each meal from direct query
  for (const meal of mealsToProcess) {
    // Skip meals that already have calendar events
    if (meal.calendar_event_id) {
      skipped++;
      continue;
    }

    // Skip meals without a recipe or custom name
    const mealName = (meal.recipe_id ? recipeNames[meal.recipe_id] : null) || meal.custom_meal_name;
    if (!mealName) {
      skipped++;
      continue;
    }

    const date = getDayDate(meal.day);
    const assignedUserId = assigneeMap.get(meal.id);
    const assignedUserName = assignedUserId
      ? userNames[assignedUserId]
      : undefined;

    try {
      const eventId = await createMealCalendarEvent(accessToken, calendarId, {
        mealId: meal.id,
        date,
        mealType: meal.meal_type,
        mealName,
        assignedUserName,
        timezone,
      });

      if (eventId) {
        // Update the meal with the calendar event ID
        await supabase
          .from("meals")
          .update({ calendar_event_id: eventId })
          .eq("id", meal.id);
        created++;
      } else {
        failed++;
        errors.push(`Failed to create event for ${mealName}`);
      }
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${mealName}: ${message}`);
    }
  }

  console.log("[sync-calendar] Final result:", {
    mealsToProcessCount: mealsToProcess.length,
    created,
    skipped,
    failed,
    recipeIdsCount: recipeIds.length,
    recipeNamesCount: Object.keys(recipeNames).length,
  });

  return NextResponse.json({
    success: true,
    created,
    skipped,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
