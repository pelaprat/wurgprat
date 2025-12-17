import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { getCalendarEvents } from "@/lib/google";

interface SyncResult {
  success: boolean;
  error?: string;
  calendarId?: string;
  eventsFound: number;
  eventsImported: number;
  eventsUpdated: number;
  eventsDeleted: number;
}

// POST to sync events from Google Calendar into the database
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  if (householdError) {
    return NextResponse.json(
      { error: "Failed to fetch household settings" },
      { status: 500 }
    );
  }

  const calendarId = household?.settings?.google_calendar_id;

  if (!calendarId) {
    return NextResponse.json(
      { error: "No calendar configured. Please select a calendar in Settings first." },
      { status: 400 }
    );
  }

  const result: SyncResult = {
    success: false,
    calendarId,
    eventsFound: 0,
    eventsImported: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
  };

  try {
    // Calculate time range: past week to 60 days ahead
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 7);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 60);

    // Fetch events from Google Calendar
    const googleEvents = await getCalendarEvents(session.accessToken, calendarId, {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });

    result.eventsFound = googleEvents.length;

    // Get existing event IDs for this household/calendar
    const { data: existingEvents } = await supabase
      .from("events")
      .select("id, google_event_id")
      .eq("household_id", user.household_id)
      .eq("google_calendar_id", calendarId);

    const existingEventMap = new Map(
      existingEvents?.map((e) => [e.google_event_id, e.id]) || []
    );
    const processedGoogleIds = new Set<string>();

    // Process each Google Calendar event
    for (const event of googleEvents) {
      if (!event.id) continue;

      processedGoogleIds.add(event.id);

      const eventData = {
        household_id: user.household_id,
        google_calendar_id: calendarId,
        google_event_id: event.id,
        title: event.summary || "Untitled Event",
        description: event.description || null,
        start_time: event.start?.dateTime || `${event.start?.date}T00:00:00Z`,
        end_time: event.end?.dateTime || (event.end?.date ? `${event.end?.date}T23:59:59Z` : null),
        all_day: !event.start?.dateTime,
        location: event.location || null,
        updated_at: new Date().toISOString(),
      };

      if (existingEventMap.has(event.id)) {
        // Update existing event
        const { error: updateError } = await supabase
          .from("events")
          .update(eventData)
          .eq("id", existingEventMap.get(event.id));

        if (!updateError) {
          result.eventsUpdated++;
        }
      } else {
        // Insert new event
        const { error: insertError } = await supabase
          .from("events")
          .insert(eventData);

        if (!insertError) {
          result.eventsImported++;
        }
      }
    }

    // Delete events that no longer exist in Google Calendar
    const eventsToDelete = existingEvents?.filter(
      (e) => e.google_event_id && !processedGoogleIds.has(e.google_event_id)
    ) || [];

    if (eventsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .in("id", eventsToDelete.map((e) => e.id));

      if (!deleteError) {
        result.eventsDeleted = eventsToDelete.length;
      }
    }

    result.success = true;
  } catch (error) {
    console.error("Failed to sync calendar events:", error);
    result.error = error instanceof Error ? error.message : "Failed to sync events";
  }

  return NextResponse.json(result);
}
