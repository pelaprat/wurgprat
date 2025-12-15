"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface SheetResult {
  url: string;
  status: "active" | "wishlist";
  success: boolean;
  error?: string;
  rowCount: number;
  headersFound: string[];
  recipesFound: number;
  recipesImported: number;
  recipesSkipped: number;
  skippedReasons: string[];
}

interface ImportResult {
  imported: number;
  sheets: SheetResult[];
}

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
  backgroundColor?: string;
}

// Common timezones grouped by region
const TIMEZONE_OPTIONS = [
  { group: "US & Canada", timezones: [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Phoenix", label: "Arizona (MST)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Anchorage", label: "Alaska Time" },
    { value: "Pacific/Honolulu", label: "Hawaii Time" },
  ]},
  { group: "Europe", timezones: [
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris (CET)" },
    { value: "Europe/Berlin", label: "Berlin (CET)" },
    { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
    { value: "Europe/Rome", label: "Rome (CET)" },
    { value: "Europe/Madrid", label: "Madrid (CET)" },
  ]},
  { group: "Asia & Pacific", timezones: [
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "Shanghai (CST)" },
    { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
    { value: "Asia/Singapore", label: "Singapore (SGT)" },
    { value: "Asia/Seoul", label: "Seoul (KST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST)" },
    { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
    { value: "Pacific/Auckland", label: "Auckland (NZST)" },
  ]},
  { group: "Other", timezones: [
    { value: "UTC", label: "UTC" },
  ]},
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [cookedRecipesUrl, setCookedRecipesUrl] = useState("");
  const [wishlistRecipesUrl, setWishlistRecipesUrl] = useState("");
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("America/New_York");
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [calendarsError, setCalendarsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [importMessage, setImportMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (session) {
      fetchSettings();
      fetchCalendars();
    }
  }, [session]);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setCookedRecipesUrl(data.settings?.cooked_recipes_sheet_url || "");
        setWishlistRecipesUrl(data.settings?.wishlist_recipes_sheet_url || "");
        setSelectedCalendarId(data.settings?.google_calendar_id || "");
        setSelectedTimezone(data.timezone || "America/New_York");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCalendars = async () => {
    setIsLoadingCalendars(true);
    setCalendarsError(null);
    try {
      const response = await fetch("/api/calendars");
      if (response.ok) {
        const data = await response.json();
        setCalendars(data.calendars || []);
      } else {
        const data = await response.json();
        setCalendarsError(data.error || "Failed to fetch calendars");
      }
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
      setCalendarsError("Failed to fetch calendars");
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cooked_recipes_sheet_url: cookedRecipesUrl,
          wishlist_recipes_sheet_url: wishlistRecipesUrl,
          google_calendar_id: selectedCalendarId,
          timezone: selectedTimezone,
        }),
      });

      if (response.ok) {
        setSaveMessage({
          type: "success",
          text: "All settings saved successfully!",
        });
      } else {
        const data = await response.json();
        setSaveMessage({
          type: "error",
          text: data.error || "Failed to save settings.",
        });
      }
    } catch {
      setSaveMessage({
        type: "error",
        text: "Failed to save settings. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportRecipes = async () => {
    if (!cookedRecipesUrl && !wishlistRecipesUrl) {
      setImportMessage({
        type: "error",
        text: "Please enter at least one Google Sheet URL first.",
      });
      return;
    }

    setIsImporting(true);
    setImportMessage({
      type: "info",
      text: "Importing recipes... This may take a few minutes.",
    });
    setImportResult(null);

    try {
      const response = await fetch("/api/recipes/import", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data);
        if (data.imported > 0) {
          setImportMessage({
            type: "success",
            text: `Successfully imported ${data.imported} recipes!`,
          });
        } else {
          setImportMessage({
            type: "info",
            text: "Import completed. See details below.",
          });
        }
      } else {
        setImportMessage({
          type: "error",
          text: data.error || "Failed to import recipes.",
        });
      }
    } catch {
      setImportMessage({
        type: "error",
        text: "Failed to import recipes. Please try again.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view settings.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Section 1: Recipe Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
            <svg
              className="w-4 h-4 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Recipe Settings
          </h2>
        </div>

        <p className="text-gray-600 mb-6">
          Connect your Google Sheets to import recipes. You can have separate
          sheets for recipes you&apos;ve already cooked and recipes you want to
          try.
        </p>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="cooked-recipes-url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Cooked Recipes Sheet URL
            </label>
            <input
              type="url"
              id="cooked-recipes-url"
              value={cookedRecipesUrl}
              onChange={(e) => setCookedRecipesUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Recipes you and your household have already made.
            </p>
          </div>

          <div>
            <label
              htmlFor="wishlist-recipes-url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Wishlist Recipes Sheet URL
            </label>
            <input
              type="url"
              id="wishlist-recipes-url"
              value={wishlistRecipesUrl}
              onChange={(e) => setWishlistRecipesUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Recipes you want to try in the future.
            </p>
          </div>
        </div>

        {/* Recipe Import Section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-md font-semibold text-gray-800 mb-3">
            Import Recipes
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            Import recipes from your Google Sheets. This will read the sheets,
            fetch each recipe URL to extract ingredients, and save everything to
            your recipe library.
          </p>

          {importMessage && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                importMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800"
                  : importMessage.type === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-blue-50 text-blue-800"
              }`}
            >
              {importMessage.text}
            </div>
          )}

          <button
            onClick={handleImportRecipes}
            disabled={isImporting || (!cookedRecipesUrl && !wishlistRecipesUrl)}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center border border-gray-300"
          >
            {isImporting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Importing...
              </>
            ) : (
              "Import Recipes"
            )}
          </button>

          {importResult && importResult.sheets.length > 0 && (
            <div className="mt-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">
                Import Details
              </h4>
              {importResult.sheets.map((sheet, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    sheet.success
                      ? "border-gray-200 bg-gray-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {sheet.status === "active"
                        ? "Cooked Recipes"
                        : "Wishlist Recipes"}
                    </span>
                    {sheet.success ? (
                      <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded">
                        Sheet found
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                        Error
                      </span>
                    )}
                  </div>

                  {sheet.error && (
                    <p className="text-sm text-red-700 mb-2">{sheet.error}</p>
                  )}

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Rows in sheet: {sheet.rowCount}</p>
                    {sheet.headersFound.length > 0 && (
                      <p>Headers found: {sheet.headersFound.join(", ")}</p>
                    )}
                    <p>Recipes found: {sheet.recipesFound}</p>
                    <p>Recipes imported: {sheet.recipesImported}</p>
                    <p>Recipes skipped: {sheet.recipesSkipped}</p>
                  </div>

                  {sheet.skippedReasons.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                        View skip reasons ({sheet.skippedReasons.length})
                      </summary>
                      <ul className="mt-2 text-sm text-gray-600 space-y-1 ml-4 list-disc">
                        {sheet.skippedReasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Google Calendar Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Google Calendar
          </h2>
        </div>

        <p className="text-gray-600 mb-6">
          Connect a Google Calendar to view household events and add meal
          planning events. Events will be read directly from your calendar.
        </p>

        <div>
          <label
            htmlFor="google-calendar"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Calendar
          </label>

          {isLoadingCalendars ? (
            <div className="flex items-center text-gray-500 py-2">
              <svg
                className="animate-spin h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading calendars...
            </div>
          ) : calendarsError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {calendarsError}
              <button
                onClick={fetchCalendars}
                className="ml-2 text-red-800 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          ) : calendars.length === 0 ? (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              No calendars found. Make sure you have granted calendar access.
              <button
                onClick={fetchCalendars}
                className="ml-2 text-yellow-800 underline hover:no-underline"
              >
                Refresh
              </button>
            </div>
          ) : (
            <select
              id="google-calendar"
              value={selectedCalendarId}
              onChange={(e) => setSelectedCalendarId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
            >
              <option value="">-- Select a calendar --</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.summary}
                  {cal.primary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
          )}

          <p className="mt-2 text-sm text-gray-500">
            Events from the selected calendar will be displayed in the Events
            page. Meal planning events will be added to this calendar.
          </p>

          {selectedCalendarId && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Selected:</strong>{" "}
                {calendars.find((c) => c.id === selectedCalendarId)?.summary ||
                  selectedCalendarId}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Calendar ID: {selectedCalendarId}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Timezone Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
            <svg
              className="w-4 h-4 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Timezone
          </h2>
        </div>

        <p className="text-gray-600 mb-6">
          Set your household&apos;s timezone. This affects how dates and times are
          displayed throughout the app.
        </p>

        <div>
          <label
            htmlFor="timezone"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Timezone
          </label>
          <select
            id="timezone"
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
          >
            {TIMEZONE_OPTIONS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-2 text-sm text-gray-500">
            Currently set to: {TIMEZONE_OPTIONS.flatMap(g => g.timezones).find(t => t.value === selectedTimezone)?.label || selectedTimezone}
          </p>
        </div>
      </div>

      {/* Save Settings Button - applies to all settings above */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-md font-semibold text-gray-800">
              Save All Settings
            </h3>
            <p className="text-sm text-gray-600">
              Save all recipe and events settings above.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {saveMessage && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              saveMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {saveMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}
