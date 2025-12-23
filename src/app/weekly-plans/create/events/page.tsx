"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMealPlanWizard } from "@/contexts/MealPlanWizardContext";
import { Event } from "@/contexts/EventsContext";
import { formatDateLocal } from "@/utils/dates";
import { DAY_NAMES } from "@/constants/calendar";

interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

interface EventCardProps {
  event: Event;
  assignedUserIds: string[];
  householdMembers: HouseholdMember[];
  onToggleUser: (eventId: string, userId: string) => void;
}

function EventCard({ event, assignedUserIds, householdMembers, onToggleUser }: EventCardProps) {
  const eventTime = event.all_day
    ? "All day"
    : new Date(event.start_time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-600 flex-shrink-0"
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
            <h3 className="font-medium text-gray-900">{event.title}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">{eventTime}</p>
          {event.location && (
            <p className="text-sm text-gray-500 mt-1">
              <span className="inline-flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {event.location}
              </span>
            </p>
          )}
        </div>

        {/* User checkboxes */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500 font-medium">Who&apos;s doing it?</span>
          {householdMembers.map((member) => {
            const isAssigned = assignedUserIds.includes(member.id);
            return (
              <label
                key={member.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                  isAssigned
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isAssigned}
                  onChange={() => onToggleUser(event.id, member.id)}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span
                  className={`text-sm ${
                    isAssigned ? "text-emerald-800" : "text-gray-700"
                  }`}
                >
                  {member.name || member.email}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface DayEventsProps {
  day: number;
  date: string;
  events: Event[];
  householdMembers: HouseholdMember[];
  getAssignedUserIds: (eventId: string) => string[];
  onToggleUser: (eventId: string, userId: string) => void;
}

function DayEvents({
  day,
  date,
  events,
  householdMembers,
  getAssignedUserIds,
  onToggleUser,
}: DayEventsProps) {
  const dayName = DAY_NAMES[day - 1];

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-medium text-gray-900">{dayName}</span>
        <span className="text-sm text-gray-500">
          {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full ml-auto">
          {events.length} event{events.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            assignedUserIds={getAssignedUserIds(event.id)}
            householdMembers={householdMembers}
            onToggleUser={onToggleUser}
          />
        ))}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const wizard = useMealPlanWizard();

  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);

  // Fetch household members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch("/api/household/members");
        if (response.ok) {
          const data = await response.json();
          setHouseholdMembers(data.members || []);
        }
      } catch (err) {
        console.error("Failed to fetch household members:", err);
      }
    };
    fetchMembers();
  }, []);

  // Redirect if no meals proposed yet or no events
  useEffect(() => {
    if (!wizard.proposedMeals || wizard.proposedMeals.length === 0) {
      router.replace("/weekly-plans/create/input");
      return;
    }
    if (wizard.weekEvents.length === 0) {
      // Skip to groceries if no events
      router.replace("/weekly-plans/create/groceries");
    }
  }, [wizard.proposedMeals, wizard.weekEvents, router]);

  // Get dates for the week
  const getWeekDates = (): string[] => {
    if (!wizard.weekOf) return [];
    const start = new Date(wizard.weekOf + "T00:00:00");
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(formatDateLocal(date));
    }
    return dates;
  };

  // Get events for each day
  const getEventsForDay = (date: string): Event[] => {
    return wizard.weekEvents.filter((event) => {
      const eventDate = formatDateLocal(new Date(event.start_time));
      return eventDate === date;
    }).sort((a, b) => {
      // Sort by time
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  };

  // Get assigned user IDs for an event
  const getAssignedUserIds = (eventId: string): string[] => {
    const assignment = wizard.eventAssignments.find((a) => a.eventId === eventId);
    return assignment?.assignedUserIds || [];
  };

  // Handle toggle user assignment
  const handleToggleUser = (eventId: string, userId: string) => {
    wizard.toggleEventUserAssignment(eventId, userId);
  };

  // Days with events
  const daysWithEvents = useMemo(() => {
    const weekDates = getWeekDates();
    return weekDates
      .map((date, index) => ({
        day: index + 1,
        date,
        events: getEventsForDay(date),
      }))
      .filter((d) => d.events.length > 0);
  }, [wizard.weekOf, wizard.weekEvents]);

  // Count unassigned events
  const unassignedCount = useMemo(() => {
    return wizard.weekEvents.filter((event) => {
      const assigned = getAssignedUserIds(event.id);
      return assigned.length === 0;
    }).length;
  }, [wizard.weekEvents, wizard.eventAssignments]);

  // Handle continue
  const handleContinue = () => {
    router.push("/weekly-plans/create/groceries");
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to continue.</p>
      </div>
    );
  }

  if (wizard.weekEvents.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link
            href="/weekly-plans"
            className="hover:text-emerald-600 transition-colors"
          >
            Weekly Plans
          </Link>
          <span>/</span>
          <Link
            href="/weekly-plans/create/input"
            className="hover:text-emerald-600 transition-colors"
          >
            Create
          </Link>
          <span>/</span>
          <span className="text-gray-900">Events</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Event Assignments</h1>
        <p className="text-gray-600 mt-1">
          Step 3 of 4: Assign who&apos;s responsible for each event
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="ml-2 text-sm text-emerald-600">Start</span>
        </div>
        <div className="flex-1 h-0.5 bg-emerald-600 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="ml-2 text-sm text-emerald-600">Meals</span>
        </div>
        <div className="flex-1 h-0.5 bg-emerald-600 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-medium">
            3
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Events</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            4
          </div>
          <span className="ml-2 text-sm text-gray-500">Groceries</span>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-amber-600"
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
          <div>
            <h3 className="text-sm font-medium text-amber-900">
              {wizard.weekEvents.length} event{wizard.weekEvents.length > 1 ? "s" : ""} this week
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Select who&apos;s attending each event to help plan around schedules.
              {unassignedCount > 0 && (
                <span className="ml-1 font-medium">
                  ({unassignedCount} unassigned)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Events by day */}
      <div className="space-y-4">
        {daysWithEvents.map(({ day, date, events }) => (
          <DayEvents
            key={day}
            day={day}
            date={date}
            events={events}
            householdMembers={householdMembers}
            getAssignedUserIds={getAssignedUserIds}
            onToggleUser={handleToggleUser}
          />
        ))}
      </div>

      {/* Warning about unassigned events */}
      {unassignedCount > 0 && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <svg
            className="w-5 h-5 text-amber-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-amber-800">
            <span className="font-medium">{unassignedCount} event{unassignedCount > 1 ? "s" : ""}</span> still need{unassignedCount === 1 ? "s" : ""} someone assigned. Select at least one person for each event.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex justify-between items-center">
        <Link
          href="/weekly-plans/create/review"
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
        >
          <span>&larr;</span>
          Back to Meals
        </Link>
        <button
          onClick={handleContinue}
          disabled={unassignedCount > 0}
          className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            unassignedCount === 0
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Continue to Groceries
          <span className={unassignedCount === 0 ? "text-emerald-200" : "text-gray-400"}>&rarr;</span>
        </button>
      </div>
    </div>
  );
}
