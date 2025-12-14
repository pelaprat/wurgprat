"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Event {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  all_day: boolean;
  location?: string;
  google_calendar_id?: string;
  google_event_id?: string;
  created_at: string;
  updated_at: string;
}

export default function EventDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/events/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setEvent(data.event);
        } else {
          setError("Event not found");
        }
      } catch {
        setError("Failed to load event");
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchEvent();
    }
  }, [session, params.id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const response = await fetch(`/api/events/${params.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/events");
      } else {
        alert("Failed to delete event");
      }
    } catch {
      alert("Failed to delete event");
    }
  };

  const formatDateTime = (dateStr: string, allDay: boolean) => {
    const date = new Date(dateStr);
    if (allDay) {
      return date.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return date.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isPast = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view this event.</p>
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

  if (error || !event) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">{error || "Event not found"}</p>
          <Link
            href="/events"
            className="text-emerald-600 hover:text-emerald-700 mt-4 inline-block"
          >
            Back to events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/events"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to events
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <p className="text-gray-600 mt-1">
              {formatDateTime(event.start_time, event.all_day)}
            </p>
          </div>
          <div className="flex space-x-2">
            {isPast(event.start_time) && (
              <span className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full">
                Past
              </span>
            )}
            {event.all_day && (
              <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
                All day
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Time Details */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Time Details
            </h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Starts:</span>
                <p className="font-medium">
                  {formatDateTime(event.start_time, event.all_day)}
                </p>
              </div>
              {event.end_time && (
                <div>
                  <span className="text-sm text-gray-600">Ends:</span>
                  <p className="font-medium">
                    {formatDateTime(event.end_time, event.all_day)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Description
              </h2>
              <p className="text-gray-600 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Location */}
          {event.location && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Location
              </h2>
              <p className="text-gray-600">{event.location}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  event.location
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-600 hover:text-emerald-700 mt-2 inline-block"
              >
                View on map &rarr;
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Actions</h2>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete Event
            </button>
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-400 px-2">
            <p>Created: {new Date(event.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(event.updated_at).toLocaleString()}</p>
            {event.google_event_id && (
              <p className="mt-1 truncate" title={event.google_event_id}>
                Source ID: {event.google_event_id.substring(0, 20)}...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
