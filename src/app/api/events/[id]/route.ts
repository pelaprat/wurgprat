import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import {
  getCalendarClient,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google";

// Helper to get calendar ID from household settings
async function getCalendarId(email: string) {
  const supabase = getServiceSupabase();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", email)
    .single();

  if (userError || !user?.household_id) {
    return null;
  }

  const { data: household } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  return household?.settings?.google_calendar_id || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const calendarId = await getCalendarId(session.user.email);

  if (!calendarId) {
    return NextResponse.json(
      { error: "No calendar configured" },
      { status: 400 }
    );
  }

  try {
    const calendar = getCalendarClient(session.accessToken);

    const response = await calendar.events.get({
      calendarId,
      eventId: params.id,
    });

    const googleEvent = response.data;

    const event = {
      id: googleEvent.id,
      google_event_id: googleEvent.id,
      title: googleEvent.summary || "Untitled Event",
      description: googleEvent.description || null,
      location: googleEvent.location || null,
      start_time: googleEvent.start?.dateTime || googleEvent.start?.date,
      end_time: googleEvent.end?.dateTime || googleEvent.end?.date,
      all_day: !googleEvent.start?.dateTime,
      calendar_id: calendarId,
      html_link: googleEvent.htmlLink,
      created_at: googleEvent.created,
      updated_at: googleEvent.updated,
    };

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const calendarId = await getCalendarId(session.user.email);

  if (!calendarId) {
    return NextResponse.json(
      { error: "No calendar configured" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { title, description, location, start_time, end_time, all_day } = body;

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const eventUpdate: {
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string; timeZone?: string };
      end?: { dateTime?: string; date?: string; timeZone?: string };
    } = {};

    if (title !== undefined) eventUpdate.summary = title;
    if (description !== undefined) eventUpdate.description = description;
    if (location !== undefined) eventUpdate.location = location;

    if (start_time !== undefined) {
      eventUpdate.start = all_day
        ? { date: start_time.split("T")[0] }
        : { dateTime: start_time, timeZone };
    }

    if (end_time !== undefined) {
      eventUpdate.end = all_day
        ? { date: end_time.split("T")[0] }
        : { dateTime: end_time, timeZone };
    }

    const updatedEvent = await updateCalendarEvent(
      session.accessToken,
      calendarId,
      params.id,
      eventUpdate
    );

    return NextResponse.json({
      event: {
        id: updatedEvent.id,
        title: updatedEvent.summary,
        description: updatedEvent.description,
        location: updatedEvent.location,
        start_time: updatedEvent.start?.dateTime || updatedEvent.start?.date,
        end_time: updatedEvent.end?.dateTime || updatedEvent.end?.date,
        all_day: !updatedEvent.start?.dateTime,
        html_link: updatedEvent.htmlLink,
      },
      message: "Event updated successfully",
    });
  } catch (error) {
    console.error("Failed to update event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const calendarId = await getCalendarId(session.user.email);

  if (!calendarId) {
    return NextResponse.json(
      { error: "No calendar configured" },
      { status: 400 }
    );
  }

  try {
    await deleteCalendarEvent(session.accessToken, calendarId, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
