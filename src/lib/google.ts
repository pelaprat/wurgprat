import { google } from "googleapis";
import { validateIcsUrl, fetchWithTimeout } from "@/utils/url";

// Special identifier to mark meal events in Google Calendar
// This is used to skip importing these events back as "events" in our app
export const MEAL_EVENT_IDENTIFIER = "[HouseholdManager:Meal]";

export function getGoogleAuth(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

export function getCalendarClient(accessToken: string) {
  const auth = getGoogleAuth(accessToken);
  return google.calendar({ version: "v3", auth });
}

export function getDriveClient(accessToken: string) {
  const auth = getGoogleAuth(accessToken);
  return google.drive({ version: "v3", auth });
}

// List user's calendars
export async function listCalendars(accessToken: string) {
  const calendar = getCalendarClient(accessToken);

  const response = await calendar.calendarList.list({
    minAccessRole: "writer", // Only calendars we can write to
  });

  return response.data.items || [];
}

// Get events from a specific calendar
export async function getCalendarEvents(
  accessToken: string,
  calendarId: string,
  options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    search?: string;
  } = {}
) {
  const calendar = getCalendarClient(accessToken);

  const response = await calendar.events.list({
    calendarId,
    timeMin: options.timeMin || new Date().toISOString(),
    timeMax: options.timeMax,
    maxResults: options.maxResults || 250,
    singleEvents: true,
    orderBy: "startTime",
    q: options.search,
  });

  return response.data.items || [];
}

// Create an event in a calendar
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
  }
) {
  const calendar = getCalendarClient(accessToken);

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  return response.data;
}

// Update an event in a calendar
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: {
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
  }
) {
  const calendar = getCalendarClient(accessToken);

  const response = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: event,
  });

  return response.data;
}

// Delete an event from a calendar
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
) {
  const calendar = getCalendarClient(accessToken);

  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

// Add a meal to Google Calendar
export async function addMealToCalendar(
  accessToken: string,
  calendarId: string,
  date: string,
  mealType: string,
  mealName: string,
  description?: string
) {
  const startTime = getMealTime(date, mealType);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return createCalendarEvent(accessToken, calendarId, {
    summary: `${mealType}: ${mealName}`,
    description: description || "",
    start: {
      dateTime: startTime.toISOString(),
      timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone,
    },
  });
}

function getMealTime(date: string, mealType: string): Date {
  // Parse date string as local date (not UTC) by splitting components
  // This avoids the timezone shift that occurs with new Date("YYYY-MM-DD")
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day); // month is 0-indexed

  const hours: Record<string, number> = {
    breakfast: 8,
    lunch: 12,
    dinner: 19,
    snack: 15,
  };
  d.setHours(hours[mealType] || 12, 0, 0, 0);
  return d;
}

// Create a Google Calendar event for a meal
export async function createMealCalendarEvent(
  accessToken: string,
  calendarId: string,
  options: {
    mealId: string;
    date: string;
    mealType: string;
    mealName: string;
    assignedUserName?: string;
    timezone?: string;
  }
): Promise<string | null> {
  const { mealId, date, mealType, mealName, assignedUserName, timezone } = options;

  // Build the title: "Spaghetti (Chef: John)" for dinner, "Breakfast: Pancakes" for others
  let title = mealType === "dinner"
    ? mealName
    : `${mealType.charAt(0).toUpperCase() + mealType.slice(1)}: ${mealName}`;
  if (assignedUserName) {
    title += ` (Chef: ${assignedUserName})`;
  }

  // Build description with identifier
  const description = `${MEAL_EVENT_IDENTIFIER}\nMeal ID: ${mealId}`;

  const startTime = getMealTime(date, mealType);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    const event = await createCalendarEvent(accessToken, calendarId, {
      summary: title,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: tz,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: tz,
      },
    });

    return event.id || null;
  } catch (error) {
    console.error("Failed to create meal calendar event:", error);
    return null;
  }
}

// Update a Google Calendar event for a meal (e.g., when assignee changes)
export async function updateMealCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  options: {
    mealId: string;
    mealName: string;
    mealType: string;
    assignedUserName?: string;
  }
): Promise<boolean> {
  const { mealId, mealName, mealType, assignedUserName } = options;

  // Build the title: "Spaghetti (Chef: John)" for dinner, "Breakfast: Pancakes" for others
  let title = mealType === "dinner"
    ? mealName
    : `${mealType.charAt(0).toUpperCase() + mealType.slice(1)}: ${mealName}`;
  if (assignedUserName) {
    title += ` (Chef: ${assignedUserName})`;
  }

  // Build description with identifier
  const description = `${MEAL_EVENT_IDENTIFIER}\nMeal ID: ${mealId}`;

  try {
    await updateCalendarEvent(accessToken, calendarId, eventId, {
      summary: title,
      description,
    });
    return true;
  } catch (error) {
    console.error("Failed to update meal calendar event:", error);
    return false;
  }
}

// Update a Google Calendar event's date/time when a meal is moved to a different day
export async function updateMealCalendarEventDateTime(
  accessToken: string,
  calendarId: string,
  eventId: string,
  options: {
    newDate: string;      // YYYY-MM-DD format
    mealType: string;
    timezone?: string;
  }
): Promise<boolean> {
  const { newDate, mealType, timezone } = options;

  const startTime = getMealTime(newDate, mealType);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    await updateCalendarEvent(accessToken, calendarId, eventId, {
      start: {
        dateTime: startTime.toISOString(),
        timeZone: tz,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: tz,
      },
    });
    return true;
  } catch (error) {
    console.error("Failed to update meal calendar event date/time:", error);
    return false;
  }
}

// Delete a Google Calendar event for a meal
export async function deleteMealCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    await deleteCalendarEvent(accessToken, calendarId, eventId);
    return true;
  } catch (error) {
    console.error("Failed to delete meal calendar event:", error);
    return false;
  }
}

// Check if an event description indicates it's a meal event from our app
export function isMealEvent(description?: string | null): boolean {
  if (!description) return false;
  return description.includes(MEAL_EVENT_IDENTIFIER);
}

// Event type for parsed ICS events
export interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime?: Date;
  allDay: boolean;
}

// Parse ICS date format (e.g., "20231215T180000Z" or "20231215")
function parseIcsDate(dateStr: string): { date: Date; allDay: boolean } {
  // Remove any trailing Z for consistent parsing
  const cleanStr = dateStr.replace(/Z$/, "");

  // Check if it's an all-day event (no time component)
  if (cleanStr.length === 8) {
    // Format: YYYYMMDD
    const year = parseInt(cleanStr.slice(0, 4));
    const month = parseInt(cleanStr.slice(4, 6)) - 1;
    const day = parseInt(cleanStr.slice(6, 8));
    return { date: new Date(year, month, day), allDay: true };
  }

  // Format: YYYYMMDDTHHMMSS
  const year = parseInt(cleanStr.slice(0, 4));
  const month = parseInt(cleanStr.slice(4, 6)) - 1;
  const day = parseInt(cleanStr.slice(6, 8));
  const hour = parseInt(cleanStr.slice(9, 11)) || 0;
  const minute = parseInt(cleanStr.slice(11, 13)) || 0;
  const second = parseInt(cleanStr.slice(13, 15)) || 0;

  // If original string ended with Z, it's UTC
  if (dateStr.endsWith("Z")) {
    return { date: new Date(Date.UTC(year, month, day, hour, minute, second)), allDay: false };
  }

  return { date: new Date(year, month, day, hour, minute, second), allDay: false };
}

// Fetch and parse an ICS calendar file
export async function fetchIcsCalendar(icsUrl: string): Promise<CalendarEvent[]> {
  // Validate URL to prevent SSRF attacks
  const validation = validateIcsUrl(icsUrl);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid calendar URL");
  }

  const response = await fetchWithTimeout(icsUrl, {}, 30000);

  if (!response.ok) {
    throw new Error(`Failed to fetch ICS file: ${response.status}`);
  }

  const icsContent = await response.text();
  return parseIcsContent(icsContent);
}

// Parse ICS content into events
export function parseIcsContent(icsContent: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Split into lines and handle line folding (lines starting with space are continuations)
  const lines = icsContent.replace(/\r\n /g, "").replace(/\r\n\t/g, "").split(/\r?\n/);

  let currentEvent: Partial<CalendarEvent> | null = null;
  let inEvent = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT" && currentEvent) {
      // Only add events that have required fields
      if (currentEvent.uid && currentEvent.summary && currentEvent.startTime) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
      inEvent = false;
      continue;
    }

    if (!inEvent || !currentEvent) continue;

    // Parse property
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const propertyPart = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);

    // Handle properties with parameters (e.g., "DTSTART;VALUE=DATE:20231215")
    const [property] = propertyPart.split(";");

    switch (property) {
      case "UID":
        currentEvent.uid = value;
        break;
      case "SUMMARY":
        currentEvent.summary = value.replace(/\\,/g, ",").replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
        break;
      case "DESCRIPTION":
        currentEvent.description = value.replace(/\\,/g, ",").replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
        break;
      case "LOCATION":
        currentEvent.location = value.replace(/\\,/g, ",").replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
        break;
      case "DTSTART": {
        const { date, allDay } = parseIcsDate(value);
        currentEvent.startTime = date;
        currentEvent.allDay = allDay;
        break;
      }
      case "DTEND": {
        const { date } = parseIcsDate(value);
        currentEvent.endTime = date;
        break;
      }
    }
  }

  return events;
}

// Save grocery list to Google Drive as a document
export async function saveGroceryListToDrive(
  accessToken: string,
  items: string[],
  weekOf: string
) {
  const drive = getDriveClient(accessToken);

  const content = `Grocery List - Week of ${weekOf}\n\n${items.map((item) => `☐ ${item}`).join("\n")}`;

  const response = await drive.files.create({
    requestBody: {
      name: `Grocery List - ${weekOf}`,
      mimeType: "application/vnd.google-apps.document",
    },
    media: {
      mimeType: "text/plain",
      body: content,
    },
  });

  return response.data;
}
