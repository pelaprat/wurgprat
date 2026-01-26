"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PageHeaderSkeleton, CardSkeleton } from "@/components/Skeleton";
import type { AllowanceSplitConfig } from "@/types";

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

const DEFAULT_SPLITS: AllowanceSplitConfig[] = [
  { key: "charity", name: "Charity", percentage: 10 },
  { key: "saving", name: "Saving", percentage: 20 },
  { key: "spending", name: "Spending", percentage: 70 },
];

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

  // Allowance splits state
  const [allowanceSplits, setAllowanceSplits] = useState<AllowanceSplitConfig[]>(DEFAULT_SPLITS);
  const [isSavingSplits, setIsSavingSplits] = useState(false);
  const [splitsMessage, setSplitsMessage] = useState<{
    type: "success" | "error";
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

  const fetchAllowanceSplits = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/allowance-splits");
      if (response.ok) {
        const data = await response.json();
        setAllowanceSplits(data.splits || DEFAULT_SPLITS);
      }
    } catch (error) {
      console.error("Failed to fetch allowance splits:", error);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchSettings();
      fetchCalendars();
      fetchAllowanceSplits();
    }
  }, [session, fetchSettings, fetchCalendars, fetchAllowanceSplits]);

  const handleSave = async (confirmCalendarChange = false) => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_calendar_id: selectedCalendarId,
          timezone: selectedTimezone,
          confirm_calendar_change: confirmCalendarChange,
        }),
      });

      const data = await response.json();

      if (response.ok) {
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

        setOriginalCalendarId(selectedCalendarId);
        setSaveMessage({
          type: "success",
          text: data.calendar_changed ? "Settings saved. Sync to import events from the new calendar." : "Settings saved!",
        });
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to save settings." });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Failed to save settings." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCalendarChange = async () => {
    setCalendarConfirmation({ ...calendarConfirmation, show: false });
    await handleSave(true);
  };

  const handleCancelCalendarChange = () => {
    setSelectedCalendarId(originalCalendarId);
    setCalendarConfirmation({ show: false, existingEventCount: 0, newCalendarId: "", newCalendarName: "" });
  };

  const handleSyncEvents = async () => {
    setIsSyncing(true);
    setSyncMessage({ type: "info", text: "Syncing..." });

    try {
      const response = await fetch("/api/events/sync", { method: "POST" });
      const data = await response.json();

      if (response.ok && data.success) {
        setSyncMessage({
          type: "success",
          text: `Done! ${data.eventsImported} imported, ${data.eventsUpdated} updated, ${data.eventsDeleted} removed.`,
        });
      } else {
        setSyncMessage({ type: "error", text: data.error || "Failed to sync events." });
      }
    } catch {
      setSyncMessage({ type: "error", text: "Failed to sync events." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSplitNameChange = (index: number, name: string) => {
    setAllowanceSplits((prev) =>
      prev.map((split, i) => (i === index ? { ...split, name } : split))
    );
    setSplitsMessage(null);
  };

  const handleSplitPercentageChange = (index: number, percentage: number) => {
    setAllowanceSplits((prev) =>
      prev.map((split, i) => (i === index ? { ...split, percentage } : split))
    );
    setSplitsMessage(null);
  };

  const handleSaveSplits = async () => {
    // Validate percentages sum to 100
    const total = allowanceSplits.reduce((sum, s) => sum + s.percentage, 0);
    if (total !== 100) {
      setSplitsMessage({
        type: "error",
        text: `Percentages must sum to 100% (currently ${total}%)`,
      });
      return;
    }

    // Validate all names are filled
    if (allowanceSplits.some((s) => !s.name.trim())) {
      setSplitsMessage({
        type: "error",
        text: "All split names are required",
      });
      return;
    }

    setIsSavingSplits(true);
    setSplitsMessage(null);

    try {
      const response = await fetch("/api/settings/allowance-splits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splits: allowanceSplits }),
      });

      const data = await response.json();

      if (response.ok) {
        setSplitsMessage({ type: "success", text: "Allowance splits saved!" });
        setAllowanceSplits(data.splits);
      } else {
        setSplitsMessage({ type: "error", text: data.error || "Failed to save splits" });
      }
    } catch {
      setSplitsMessage({ type: "error", text: "Failed to save splits" });
    } finally {
      setIsSavingSplits(false);
    }
  };

  const getSplitTotal = () => allowanceSplits.reduce((sum, s) => sum + s.percentage, 0);

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
        </div>
      </div>
    );
  }

  const calendarChanged = selectedCalendarId !== originalCalendarId && originalCalendarId;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Calendar Change Confirmation Dialog */}
      {calendarConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Change Calendar?
            </h3>
            <p className="text-gray-600 mb-4">
              Switching to <strong>{calendarConfirmation.newCalendarName}</strong> will
              delete {calendarConfirmation.existingEventCount} existing events.
            </p>
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
                Change Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Settings
        {householdName && (
          <span className="text-lg font-normal text-gray-500 ml-2">
            ({householdName})
          </span>
        )}
      </h1>

      {/* Google Calendar Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Google Calendar
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="google-calendar" className="block text-sm font-medium text-gray-700 mb-1">
              Calendar
            </label>

            {isLoadingCalendars ? (
              <div className="flex items-center text-gray-500 py-2">
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </div>
            ) : calendarsError ? (
              <div className="text-red-600 text-sm">
                {calendarsError}{" "}
                <button onClick={fetchCalendars} className="underline hover:no-underline">Retry</button>
              </div>
            ) : calendars.length === 0 ? (
              <div className="text-amber-600 text-sm">
                No calendars found.{" "}
                <button onClick={fetchCalendars} className="underline hover:no-underline">Refresh</button>
              </div>
            ) : (
              <select
                id="google-calendar"
                value={selectedCalendarId}
                onChange={(e) => setSelectedCalendarId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
              >
                <option value="">Select a calendar</option>
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.summary}{cal.primary ? " (Primary)" : ""}
                  </option>
                ))}
              </select>
            )}

            {calendarChanged && (
              <p className="mt-1 text-sm text-amber-600">
                Save to apply calendar change
              </p>
            )}
          </div>

          {/* Sync Events */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-600">
              {syncMessage ? (
                <span className={
                  syncMessage.type === "success" ? "text-emerald-600" :
                  syncMessage.type === "error" ? "text-red-600" : "text-blue-600"
                }>
                  {syncMessage.text}
                </span>
              ) : (
                "Import events from Google Calendar"
              )}
            </div>
            <button
              onClick={handleSyncEvents}
              disabled={isSyncing || !selectedCalendarId || !!calendarChanged}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      </div>

      {/* Timezone Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Timezone
        </h2>

        <select
          id="timezone"
          value={selectedTimezone}
          onChange={(e) => setSelectedTimezone(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
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
      </div>

      {/* Allowance Splits Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Allowance Splits
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Configure how allowance money is split between categories for all kids.
        </p>

        <div className="space-y-3">
          {allowanceSplits.map((split, index) => (
            <div key={split.key} className="flex items-center gap-3">
              <input
                type="text"
                value={split.name}
                onChange={(e) => handleSplitNameChange(index, e.target.value)}
                placeholder="Category name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <div className="relative w-24">
                <input
                  type="number"
                  value={split.percentage}
                  onChange={(e) => handleSplitPercentageChange(index, parseInt(e.target.value) || 0)}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${getSplitTotal() === 100 ? "text-emerald-600" : "text-red-600"}`}>
              Total: {getSplitTotal()}%
            </span>
            {getSplitTotal() !== 100 && (
              <span className="text-xs text-red-500">(must equal 100%)</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {splitsMessage && (
              <span className={`text-sm ${splitsMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                {splitsMessage.text}
              </span>
            )}
            <button
              onClick={handleSaveSplits}
              disabled={isSavingSplits || getSplitTotal() !== 100}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isSavingSplits ? "Saving..." : "Save Splits"}
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {saveMessage && (
            <span className={saveMessage.type === "success" ? "text-emerald-600" : "text-red-600"}>
              {saveMessage.text}
            </span>
          )}
        </div>
        <button
          onClick={() => handleSave(false)}
          disabled={isSaving}
          className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
