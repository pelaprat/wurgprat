import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET() {
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
    return NextResponse.json(
      { error: "Household not found" },
      { status: 404 }
    );
  }

  // Get household settings and name
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("name, timezone, settings")
    .eq("id", user.household_id)
    .single();

  if (householdError) {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    name: household.name,
    timezone: household.timezone || "America/New_York",
    settings: household.settings || {}
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    google_calendar_id,
    timezone,
    confirm_calendar_change,
  } = body;

  const supabase = getServiceSupabase();

  // Get user's household
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json(
      { error: "Household not found" },
      { status: 404 }
    );
  }

  // Get current settings
  const { data: household } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  const currentCalendarId = household?.settings?.google_calendar_id;
  const calendarChanged = google_calendar_id !== undefined &&
                          google_calendar_id !== currentCalendarId;

  // If calendar is changing, require confirmation
  if (calendarChanged && !confirm_calendar_change) {
    // Count existing events to warn the user
    const { count: eventCount } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("household_id", user.household_id);

    return NextResponse.json({
      requires_confirmation: true,
      calendar_changing: true,
      existing_event_count: eventCount || 0,
      message: "Changing the calendar will delete all existing events for this household.",
    });
  }

  // If calendar is changing and confirmed, delete existing events and clear meal calendar links
  if (calendarChanged && confirm_calendar_change) {
    console.log(`[settings] Calendar changing for household ${user.household_id}, deleting existing events`);

    // First count the events
    const { count: eventCount } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("household_id", user.household_id);

    // Then delete them
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("household_id", user.household_id);

    if (deleteError) {
      console.error("[settings] Failed to delete events:", deleteError);
    } else {
      console.log(`[settings] Deleted ${eventCount || 0} events`);
    }

    // Clear calendar_event_id from all meals in this household's weekly plans
    // First get all weekly plan IDs for this household
    const { data: weeklyPlans } = await supabase
      .from("weekly_plan")
      .select("id")
      .eq("household_id", user.household_id);

    if (weeklyPlans && weeklyPlans.length > 0) {
      const planIds = weeklyPlans.map((p) => p.id);
      const { error: mealUpdateError } = await supabase
        .from("meals")
        .update({ calendar_event_id: null })
        .in("weekly_plan_id", planIds)
        .not("calendar_event_id", "is", null);

      if (mealUpdateError) {
        console.error("[settings] Failed to clear meal calendar_event_ids:", mealUpdateError);
      } else {
        console.log("[settings] Cleared calendar_event_id from meals");
      }
    }
  }

  // Merge new settings with existing
  const updatedSettings = {
    ...(household?.settings || {}),
    google_calendar_id,
  };

  // Build update object
  const updateData: { settings: typeof updatedSettings; timezone?: string } = {
    settings: updatedSettings,
  };

  // Only update timezone if provided
  if (timezone) {
    updateData.timezone = timezone;
  }

  // Update household settings
  const { error: updateError } = await supabase
    .from("households")
    .update(updateData)
    .eq("id", user.household_id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    settings: updatedSettings,
    timezone,
    calendar_changed: calendarChanged,
    events_deleted: calendarChanged && confirm_calendar_change,
  });
}
