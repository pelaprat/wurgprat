import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchIcsCalendar, isMealEvent } from "@/lib/google";

interface ImportResult {
  success: boolean;
  error?: string;
  icsUrl?: string;
  eventsFound: number;
  eventsImported: number;
  eventsUpdated: number;
  eventsSkipped: number;
  skippedReasons: string[];
  sampleEvents: Array<{ title: string; startTime: string; allDay: boolean }>;
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
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
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }

  const settings = household.settings || {};
  const icsUrl = settings.events_calendar_url;

  if (!icsUrl) {
    return NextResponse.json(
      { error: "No ICS calendar URL configured. Please save settings first." },
      { status: 400 }
    );
  }

  const result: ImportResult = {
    success: false,
    icsUrl,
    eventsFound: 0,
    eventsImported: 0,
    eventsUpdated: 0,
    eventsSkipped: 0,
    skippedReasons: [],
    sampleEvents: [],
  };

  try {
    // Fetch and parse ICS calendar
    const events = await fetchIcsCalendar(icsUrl);

    // Filter to only future events (next 60 days)
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const futureEvents = events.filter(
      (event) => event.startTime >= now && event.startTime <= sixtyDaysFromNow
    );

    result.eventsFound = futureEvents.length;

    // Add sample events for debugging (first 5)
    result.sampleEvents = futureEvents.slice(0, 5).map((event) => ({
      title: event.summary,
      startTime: event.startTime.toISOString(),
      allDay: event.allDay,
    }));

    // Process each event
    for (const event of futureEvents) {
      if (!event.uid) {
        result.eventsSkipped++;
        result.skippedReasons.push(`Event "${event.summary || 'Unknown'}" skipped: missing UID`);
        continue;
      }

      if (!event.summary) {
        result.eventsSkipped++;
        result.skippedReasons.push(`Event with UID "${event.uid}" skipped: missing title/summary`);
        continue;
      }

      // Skip meal events created by our app (to avoid importing them back)
      if (isMealEvent(event.description)) {
        result.eventsSkipped++;
        result.skippedReasons.push(`Event "${event.summary}" skipped: meal event from Household Manager`);
        continue;
      }

      // Check if event already exists
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("household_id", user.household_id)
        .eq("google_event_id", event.uid)
        .single();

      if (existing) {
        // Update existing event
        const { error: updateError } = await supabase
          .from("events")
          .update({
            title: event.summary,
            description: event.description || null,
            start_time: event.startTime.toISOString(),
            end_time: event.endTime?.toISOString() || null,
            all_day: event.allDay,
            location: event.location || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (!updateError) {
          result.eventsUpdated++;
        } else {
          result.eventsSkipped++;
          result.skippedReasons.push(`Event "${event.summary}" failed to update: ${updateError.message}`);
        }
      } else {
        // Insert new event
        const { error: insertError } = await supabase
          .from("events")
          .insert({
            household_id: user.household_id,
            google_calendar_id: icsUrl,
            google_event_id: event.uid,
            title: event.summary,
            description: event.description || null,
            start_time: event.startTime.toISOString(),
            end_time: event.endTime?.toISOString() || null,
            all_day: event.allDay,
            location: event.location || null,
          });

        if (!insertError) {
          result.eventsImported++;
        } else {
          result.eventsSkipped++;
          result.skippedReasons.push(`Event "${event.summary}" failed to insert: ${insertError.message}`);
        }
      }
    }

    result.success = true;
  } catch (error) {
    result.error = `Failed to import events: ${error instanceof Error ? error.message : String(error)}`;
  }

  return NextResponse.json(result);
}
