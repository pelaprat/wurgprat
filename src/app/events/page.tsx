"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEvents, Event } from "@/contexts/EventsContext";

type SortField = "title" | "start_time";
type SortOrder = "asc" | "desc";

// iCal-style date icon component
function DateIcon({ dateStr, isHighlighted = false }: { dateStr: string; isHighlighted?: boolean }) {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  const day = date.getDate();

  return (
    <div className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg overflow-hidden shadow-sm border ${
      isHighlighted ? "border-emerald-400" : "border-gray-200"
    }`}>
      <div className={`w-full text-center text-[10px] font-bold py-0.5 ${
        isHighlighted ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
      }`}>
        {month}
      </div>
      <div className={`flex-1 w-full flex items-center justify-center text-xl font-bold ${
        isHighlighted ? "bg-emerald-50 text-emerald-700" : "bg-white text-gray-900"
      }`}>
        {day}
      </div>
    </div>
  );
}

function formatWeekOf(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const endDate = new Date(date);
  endDate.setDate(date.getDate() + 6);
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export default function EventsPage() {
  const { data: session } = useSession();
  const { events, isLoading, lastSynced } = useEvents();
  const [search, setSearch] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [sortField, setSortField] = useState<SortField>("start_time");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const filteredAndSortedEvents = useMemo(() => {
    let result = [...events];
    const now = new Date();

    // Filter past events
    if (!showPast) {
      result = result.filter((e) => new Date(e.start_time) >= now);
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(searchLower) ||
          e.location?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | Date = "";
      let bVal: string | Date = "";

      if (sortField === "title") {
        aVal = a.title || "";
        bVal = b.title || "";
      } else if (sortField === "start_time") {
        aVal = new Date(a.start_time);
        bVal = new Date(b.start_time);
      }

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortOrder === "asc"
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return result;
  }, [events, search, showPast, sortField, sortOrder]);

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view events.</p>
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
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          {lastSynced && (
            <p className="text-xs text-gray-400 mt-1">
              Last synced: {lastSynced.toLocaleTimeString()}
            </p>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {filteredAndSortedEvents.length} of {events.length} events
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showPast}
                onChange={(e) => setShowPast(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Show past events
              </span>
            </label>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
                setShowPast(false);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* Events List - 3 Column Layout */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredAndSortedEvents.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No events found
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAndSortedEvents.map((event) => {
              const today = isToday(event.start_time);
              const past = isPast(event.start_time);
              const weeklyPlans = event.weekly_plan_assignments?.map(a => a.weekly_plan).filter(Boolean) || [];

              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-4 p-4 ${today ? "bg-emerald-50" : "hover:bg-gray-50"} ${past ? "opacity-60" : ""} transition-colors`}
                >
                  {/* Date Column - iCal Style */}
                  <div className="flex-shrink-0">
                    <DateIcon dateStr={event.start_time} isHighlighted={today} />
                  </div>

                  {/* Event Column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/events/${event.id}`}
                        className="font-medium text-gray-900 hover:text-emerald-600 transition-colors truncate"
                      >
                        {event.title}
                      </Link>
                      {today && (
                        <span className="px-2 py-0.5 text-xs bg-emerald-200 text-emerald-800 rounded-full">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-gray-500 mt-0.5">
                      <span>
                        {event.all_day
                          ? "All day"
                          : new Date(event.start_time).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                      </span>
                      {event.location && (
                        <span className="truncate">{event.location}</span>
                      )}
                    </div>
                  </div>

                  {/* Weekly Plans Column */}
                  <div className="flex-shrink-0 text-right">
                    {weeklyPlans.length > 0 ? (
                      <div className="space-y-1">
                        {weeklyPlans.map((plan) => (
                          <Link
                            key={plan.id}
                            href={`/weekly-plans/${plan.id}?tab=events`}
                            className="block text-sm text-emerald-600 hover:text-emerald-700"
                          >
                            {formatWeekOf(plan.week_of)}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
