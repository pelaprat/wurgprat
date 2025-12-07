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

export function getSheetsClient(accessToken: string) {
  const auth = getGoogleAuth(accessToken);
  return google.sheets({ version: "v4", auth });
}

// Extract spreadsheet ID from a Google Sheets URL
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Extract gid (sheet tab ID) from a Google Sheets URL
export function extractGid(url: string): number | null {
  const match = url.match(/[#&]gid=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Get sheet name by gid
async function getSheetNameByGid(
  accessToken: string,
  spreadsheetId: string,
  gid: number
): Promise<string | null> {
  const sheets = getSheetsClient(accessToken);

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const sheetsList = response.data.sheets || [];
  for (const sheet of sheetsList) {
    if (sheet.properties?.sheetId === gid) {
      return sheet.properties.title || null;
    }
  }

  return null;
}

// Read data from a Google Sheet (respects gid for specific tab)
export async function readGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string = "A:Z",
  gid?: number | null
) {
  const sheets = getSheetsClient(accessToken);

  let fullRange = range;

  // If gid is provided, look up the sheet name and prefix the range
  if (gid !== undefined && gid !== null) {
    const sheetName = await getSheetNameByGid(accessToken, spreadsheetId, gid);
    if (sheetName) {
      // Escape sheet name if it contains special characters
      const escapedName = sheetName.includes(" ") || sheetName.includes("'")
        ? `'${sheetName.replace(/'/g, "''")}'`
        : sheetName;
      fullRange = `${escapedName}!${range}`;
    }
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
  });

  return response.data.values || [];
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
