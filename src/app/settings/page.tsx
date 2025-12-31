"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PageHeaderSkeleton, CardSkeleton } from "@/components/Skeleton";

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
  backgroundColor?: string;
}

interface CalendarChangeConfirmation {
  show: boolean;
  existingEventCount: number;
  newCalendarId: string;
  newCalendarName: string;
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
  const [householdName, setHouseholdName] = useState("");
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [originalCalendarId, setOriginalCalendarId] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("America/New_York");
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [calendarsError, setCalendarsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [calendarConfirmation, setCalendarConfirmation] = useState<CalendarChangeConfirmation>({
    show: false,
    existingEventCount: 0,
    newCalendarId: "",
    newCalendarName: "",
  });
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setHouseholdName(data.name || "");
        setSelectedCalendarId(data.settings?.google_calendar_id || "");
        setOriginalCalendarId(data.settings?.google_calendar_id || "");
        setSelectedTimezone(data.timezone || "America/New_York");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCalendars = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (session) {
      fetchSettings();
      fetchCalendars();
    }
  }, [session, fetchSettings, fetchCalendars]);

  const handleSave = async (confirmCalendarChange = false) => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          google_calendar_id: selectedCalendarId,
          timezone: selectedTimezone,
          confirm_calendar_change: confirmCalendarChange,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check if we need confirmation for calendar change
        if (data.requires_confirmation) {
          const calendarName = calendars.find(c => c.id === selectedCalendarId)?.summary || selectedCalendarId;
          setCalendarConfirmation({
            show: true,
            existingEventCount: data.existing_event_count || 0,
            newCalendarId: selectedCalendarId,
            newCalendarName: calendarName,
          });
          setIsSaving(false);
          return;
        }

        // Update original calendar ID after successful save
        setOriginalCalendarId(selectedCalendarId);

        let successMessage = "All settings saved successfully!";
        if (data.calendar_changed && data.events_deleted) {
          successMessage = "Settings saved. Previous events have been deleted. Click 'Sync Events' to import events from the new calendar.";
        }

        setSaveMessage({
          type: "success",
          text: successMessage,
        });
      } else {
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

  const handleConfirmCalendarChange = async () => {
    setCalendarConfirmation({ ...calendarConfirmation, show: false });
    await handleSave(true);
  };

  const handleCancelCalendarChange = () => {
    // Revert to original calendar ID
    setSelectedCalendarId(originalCalendarId);
    setCalendarConfirmation({
      show: false,
      existingEventCount: 0,
      newCalendarId: "",
      newCalendarName: "",
    });
  };

  const handleSyncEvents = async () => {
    setIsSyncing(true);
    setSyncMessage({ type: "info", text: "Syncing events from Google Calendar..." });

    try {
      const response = await fetch("/api/events/sync", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncMessage({
          type: "success",
          text: `Sync complete! ${data.eventsImported} imported, ${data.eventsUpdated} updated, ${data.eventsDeleted} removed.`,
        });
      } else {
        setSyncMessage({
          type: "error",
          text: data.error || "Failed to sync events.",
        });
      }
    } catch {
      setSyncMessage({
        type: "error",
        text: "Failed to sync events. Please try again.",
      });
    } finally {
      setIsSyncing(false);
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
      <div className="max-w-2xl mx-auto">
        <PageHeaderSkeleton />
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Calendar Change Confirmation Dialog */}
      {calendarConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md mx-4 p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Confirm Calendar Change
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                You are about to change the household calendar to:{" "}
                <strong>{calendarConfirmation.newCalendarName}</strong>
              </p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-medium mb-2">
                  Warning: This action cannot be undone!
                </p>
                <ul className="text-red-700 text-sm space-y-1">
                  <li>
                    • <strong>{calendarConfirmation.existingEventCount}</strong> existing events will be permanently deleted
                  </li>
                  <li>• All household members will lose access to current events</li>
                  <li>• You will need to sync events from the new calendar</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> Only calendars from your Google account are shown.
                  Other household members will share these events, but they won&apos;t be able to
                  sync from their own calendars without changing this setting.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelCalendarChange}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCalendarChange}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Events & Change Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Household Settings
        {householdName && (
          <span className="text-lg font-normal text-gray-500 ml-2">
            ({householdName})
          </span>
        )}
      </h1>

      {/* Household Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-amber-800 font-medium">These are shared household settings</p>
            <p className="text-amber-700 text-sm mt-1">
              Changes you make here will affect all members of your household.
              Everyone in &quot;{householdName || "your household"}&quot; shares the same recipes, events, and preferences.
            </p>
          </div>
        </div>
      </div>

      {/* Google Calendar Settings */}
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
            Household Calendar
          </h2>
        </div>

        <p className="text-gray-600 mb-4">
          Select a Google Calendar for your household. Events from this calendar
          will be shared with all household members and displayed on the Events page.
        </p>

        {/* Calendar warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-amber-800 text-sm">
            <strong>Important:</strong> You can only see calendars from your own Google account.
            If you change the calendar, all existing household events will be deleted and
            replaced with events from the new calendar.
          </p>
        </div>

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
            Events from the selected calendar will be imported and shared with all
            household members.
          </p>

          {selectedCalendarId && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Selected:</strong>{" "}
                {calendars.find((c) => c.id === selectedCalendarId)?.summary ||
                  selectedCalendarId}
              </p>
              {selectedCalendarId !== originalCalendarId && originalCalendarId && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ Calendar changed - saving will delete existing events
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sync Events Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-md font-semibold text-gray-800 mb-3">
            Sync Events
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            Import events from the selected Google Calendar into your household.
            This will add new events, update existing ones, and remove events that
            no longer exist in Google Calendar.
          </p>

          {syncMessage && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                syncMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800"
                  : syncMessage.type === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-blue-50 text-blue-800"
              }`}
            >
              {syncMessage.text}
            </div>
          )}

          <button
            onClick={handleSyncEvents}
            disabled={isSyncing || !selectedCalendarId || selectedCalendarId !== originalCalendarId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isSyncing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Events Now
              </>
            )}
          </button>

          {!selectedCalendarId && (
            <p className="mt-2 text-sm text-gray-500">
              Select a calendar above and save settings to enable syncing.
            </p>
          )}
          {selectedCalendarId && selectedCalendarId !== originalCalendarId && (
            <p className="mt-2 text-sm text-amber-600 font-medium">
              Save your calendar settings first before syncing.
            </p>
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
              Save Household Settings
            </h3>
            <p className="text-sm text-gray-600">
              Save all settings above. Changes will affect all household members.
            </p>
          </div>
          <button
            onClick={() => handleSave(false)}
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
