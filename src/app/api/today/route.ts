import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { getDayBoundsInTimezone } from "@/utils/timezone";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user info
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, email, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get household timezone setting
  const { data: household } = await supabase
    .from("households")
    .select("timezone")
    .eq("id", user.household_id)
    .single();

  const householdTimezone = household?.timezone || "America/New_York";

  // Calculate today's date range in household timezone
  const { start: today, end: tomorrow, todayStr } = getDayBoundsInTimezone(householdTimezone);

  // Find the weekly plan that contains today
  const { data: weeklyPlans, error: plansError } = await supabase
    .from("weekly_plan")
    .select(`
      id,
      week_of,
      meals (
        id,
        day,
        meal_type,
        custom_meal_name,
        assigned_user_id,
        recipes (
          id,
          name
        ),
        assigned_user:users!meals_assigned_user_id_fkey (
          id,
          name
        )
      )
    `)
    .eq("household_id", user.household_id)
    .order("week_of", { ascending: false });

  if (plansError) {
    console.error("Failed to fetch weekly plans:", plansError);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }

  // Find plan containing today and calculate day of week
  let currentPlan = null;
  let dayOfWeek = 1;
  let todayMeals: typeof weeklyPlans[0]["meals"] = [];

  for (const plan of weeklyPlans || []) {
    const weekStart = new Date(plan.week_of + "T00:00:00");
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (today >= weekStart && today < weekEnd) {
      currentPlan = plan;
      const diffTime = today.getTime() - weekStart.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      dayOfWeek = diffDays + 1;
      todayMeals = (plan.meals || []).filter((meal) => meal.day === dayOfWeek);
      break;
    }
  }

  // Get today's events from database
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_time, end_time, all_day, location")
    .eq("household_id", user.household_id)
    .gte("start_time", today.toISOString())
    .lt("start_time", tomorrow.toISOString())
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("Failed to fetch events:", eventsError);
  }

  // Get event assignments for the current weekly plan
  let eventAssignments: { event_id: string; user_id: string }[] = [];
  if (currentPlan) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from("weekly_plan_event_assignments")
      .select("event_id, user_id")
      .eq("weekly_plan_id", currentPlan.id);

    if (!assignmentsError && assignments) {
      eventAssignments = assignments;
    }
  }

  // Calculate user's responsibilities
  const userMealAssignments = todayMeals.filter(
    (meal) => meal.assigned_user_id === user.id
  );

  const todayEventIds = (events || []).map((e) => e.id);
  const userEventAssignmentIds = eventAssignments
    .filter((a) => a.user_id === user.id && todayEventIds.includes(a.event_id))
    .map((a) => a.event_id);

  const userEventAssignments = (events || []).filter((e) =>
    userEventAssignmentIds.includes(e.id)
  );

  // Get first name for personalized greeting
  const firstName = user.name?.split(" ")[0] || user.email.split("@")[0];

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      firstName,
      email: user.email,
    },
    today: todayStr,
    weeklyPlan: currentPlan
      ? {
          id: currentPlan.id,
          week_of: currentPlan.week_of,
        }
      : null,
    dayOfWeek,
    meals: todayMeals.map((meal) => ({
      id: meal.id,
      day: meal.day,
      meal_type: meal.meal_type,
      custom_meal_name: meal.custom_meal_name,
      assigned_user_id: meal.assigned_user_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assigned_user: meal.assigned_user as any,
      recipe: meal.recipes,
    })),
    events: events || [],
    responsibilities: {
      cooking: userMealAssignments.map((meal) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recipe = meal.recipes as any;
        return {
          id: meal.id,
          name: recipe?.name || meal.custom_meal_name || "Dinner",
          meal_type: meal.meal_type,
        };
      }),
      events: userEventAssignments.map((event) => ({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        all_day: event.all_day,
      })),
    },
  });
}
