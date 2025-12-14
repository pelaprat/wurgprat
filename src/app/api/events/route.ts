import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { getCalendarEvents, createCalendarEvent } from "@/lib/google";

// GET events from Google Calendar
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user's household to retrieve calendar settings
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Get household settings for calendar ID
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
    return NextResponse.json({
      events: [],
      message: "No calendar configured. Please select a calendar in Settings.",
    });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || undefined;
  const upcoming = searchParams.get("upcoming");
  const daysAhead = parseInt(searchParams.get("days") || "60");

  try {
    // Calculate time range
    const timeMin = upcoming === "true" ? new Date().toISOString() : undefined;
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + daysAhead);

    const googleEvents = await getCalendarEvents(session.accessToken, calendarId, {
      timeMin,
      timeMax: timeMax.toISOString(),
      search,
    });

    // Transform Google Calendar events to our format
    const events = googleEvents.map((event) => ({
      id: event.id,
      google_event_id: event.id,
      title: event.summary || "Untitled Event",
      description: event.description || null,
      location: event.location || null,
      start_time: event.start?.dateTime || event.start?.date,
      end_time: event.end?.dateTime || event.end?.date,
      all_day: !event.start?.dateTime,
      calendar_id: calendarId,
      html_link: event.htmlLink,
    }));

    return NextResponse.json({ events, calendarId });
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events from Google Calendar. Please try signing out and back in." },
      { status: 500 }
    );
  }
}

// POST to create a new event in Google Calendar
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user's household to retrieve calendar settings
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Get household settings for calendar ID
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
      { error: "No calendar configured. Please select a calendar in Settings." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { title, description, location, start_time, end_time, all_day } = body;

  if (!title || !start_time) {
    return NextResponse.json(
      { error: "Title and start time are required" },
      { status: 400 }
    );
  }

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const event = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
      start: all_day
        ? { date: start_time.split("T")[0] }
        : { dateTime: start_time, timeZone },
      end: all_day
        ? { date: (end_time || start_time).split("T")[0] }
        : { dateTime: end_time || start_time, timeZone },
    };

    const createdEvent = await createCalendarEvent(
      session.accessToken,
      calendarId,
      event
    );

    return NextResponse.json({
      event: {
        id: createdEvent.id,
        title: createdEvent.summary,
        description: createdEvent.description,
        location: createdEvent.location,
        start_time: createdEvent.start?.dateTime || createdEvent.start?.date,
        end_time: createdEvent.end?.dateTime || createdEvent.end?.date,
        all_day: !createdEvent.start?.dateTime,
        html_link: createdEvent.htmlLink,
      },
      message: "Event created successfully",
    });
  } catch (error) {
    console.error("Failed to create calendar event:", error);
    return NextResponse.json(
      { error: "Failed to create event in Google Calendar" },
      { status: 500 }
    );
  }
}
