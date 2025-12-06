import { google } from "googleapis";

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

// Add a meal to Google Calendar
export async function addMealToCalendar(
  accessToken: string,
  date: string,
  mealType: string,
  mealName: string,
  description?: string
) {
  const calendar = getCalendarClient(accessToken);

  const startTime = getMealTime(date, mealType);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour

  const event = {
    summary: `${mealType}: ${mealName}`,
    description: description || "",
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });

  return response.data;
}

function getMealTime(date: string, mealType: string): Date {
  const d = new Date(date);
  const hours: Record<string, number> = {
    breakfast: 8,
    lunch: 12,
    dinner: 18,
    snack: 15,
  };
  d.setHours(hours[mealType] || 12, 0, 0, 0);
  return d;
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
