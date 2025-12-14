"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEvents, Event } from "@/contexts/EventsContext";

type SortField = "title" | "start_time" | "location";
type SortOrder = "asc" | "desc";

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
      } else if (sortField === "location") {
        aVal = a.location || "";
        bVal = b.location || "";
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">&#8597;</span>;
    }
    return sortOrder === "asc" ? (
      <span className="text-emerald-600 ml-1">&#8593;</span>
    ) : (
      <span className="text-emerald-600 ml-1">&#8595;</span>
    );
  };

  const formatEventTime = (event: Event) => {
    const start = new Date(event.start_time);
    if (event.all_day) {
      return start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
    return start.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("start_time")}
                >
                  Date/Time <SortIcon field="start_time" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("title")}
                >
                  Event <SortIcon field="title" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("location")}
                >
                  Location <SortIcon field="location" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No events found
                  </td>
                </tr>
              ) : (
                filteredAndSortedEvents.map((event) => (
                  <tr
                    key={event.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      isPast(event.start_time) ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={
                          isToday(event.start_time)
                            ? "font-semibold text-emerald-600"
                            : "text-gray-600"
                        }
                      >
                        {formatEventTime(event)}
                      </span>
                      {isToday(event.start_time) && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded">
                          Today
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/events/${event.id}`}
                        className="text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {event.location || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {event.all_day ? (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          All day
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                          Timed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
