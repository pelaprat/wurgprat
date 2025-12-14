"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { useMealPlanWizard, ProposedMeal } from "@/contexts/MealPlanWizardContext";
import { Event } from "@/contexts/EventsContext";

const DAY_NAMES = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const TIME_RATING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Very Quick", color: "bg-green-100 text-green-800" },
  2: { label: "Quick", color: "bg-green-100 text-green-800" },
  3: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  4: { label: "Long", color: "bg-red-100 text-red-800" },
  5: { label: "Very Long", color: "bg-red-100 text-red-800" },
};

interface DraggableMealProps {
  meal: ProposedMeal;
  onReplace: (day: number) => void;
  isReplacing: boolean;
}

function DraggableMeal({ meal, onReplace, isReplacing }: DraggableMealProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-${meal.day}`,
    data: { day: meal.day },
  });

  const timeRating = meal.recipeTimeRating
    ? TIME_RATING_LABELS[meal.recipeTimeRating]
    : null;

  return (
    <div
      ref={setNodeRef}
      className={`p-3 bg-white rounded-lg border-2 ${
        isDragging ? "border-emerald-500 opacity-50" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0 mt-0.5"
            title="Drag to swap with another day"
          >
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900">{meal.recipeName}</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              {timeRating && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${timeRating.color}`}
                >
                  {timeRating.label}
                </span>
              )}
              {meal.isAiSuggested ? (
                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">
                  AI suggested
                </span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                  Modified
                </span>
              )}
            </div>
            {meal.aiReasoning && (
              <p className="text-xs text-gray-500 mt-2 italic">
                &quot;{meal.aiReasoning}&quot;
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => onReplace(meal.day)}
          disabled={isReplacing}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0"
        >
          {isReplacing ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
          ) : (
            <>
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Replace
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function MealDragOverlay({ meal }: { meal: ProposedMeal }) {
  const timeRating = meal.recipeTimeRating
    ? TIME_RATING_LABELS[meal.recipeTimeRating]
    : null;

  return (
    <div className="p-3 bg-white rounded-lg border-2 border-emerald-500 shadow-lg opacity-90">
      <div className="flex items-start gap-2">
        <div className="p-1">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{meal.recipeName}</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {timeRating && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${timeRating.color}`}
              >
                {timeRating.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DaySlotProps {
  day: number;
  date: string;
  events: Event[];
  meal: ProposedMeal | undefined;
  onReplace: (day: number) => void;
  isReplacing: boolean;
  isDraggedOver: boolean;
}

function DaySlot({
  day,
  date,
  events,
  meal,
  onReplace,
  isReplacing,
  isDraggedOver,
}: DaySlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day}`,
    data: { day },
  });

  const dayName = DAY_NAMES[day - 1];
  const isBusy = events.length > 0;
  const isHighlighted = isOver || isDraggedOver;

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-colors ${
        isHighlighted ? "border-emerald-500 bg-emerald-50/30" : "border-transparent"
      }`}
    >
      {/* Day header - fixed position */}
      <div
        className={`px-4 py-2 ${isBusy ? "bg-amber-50" : "bg-gray-50"} border-b`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{dayName}</span>
            <span className="text-sm text-gray-500">
              {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          {isBusy && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
              {events.length} event{events.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Events for the day */}
      {events.length > 0 && (
        <div className="px-4 py-2 bg-amber-50/50 border-b">
          <div className="space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className="text-xs text-amber-700 flex items-center gap-1"
              >
                <span className="font-medium">-</span>
                {event.title}
                {event.all_day
                  ? " (All day)"
                  : ` at ${new Date(event.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meal content - draggable */}
      <div className="p-3">
        {meal ? (
          <DraggableMeal
            meal={meal}
            onReplace={onReplace}
            isReplacing={isReplacing}
          />
        ) : (
          <div className="p-3 border-2 border-dashed border-gray-200 rounded-lg text-center text-gray-400">
            No meal planned
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const wizard = useMealPlanWizard();

  const [replacingDay, setReplacingDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDragDay, setActiveDragDay] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Redirect if no meals proposed yet
  useEffect(() => {
    if (!wizard.proposedMeals || wizard.proposedMeals.length === 0) {
      router.replace("/weekly-plans/create/input");
    }
  }, [wizard.proposedMeals, router]);

  // Get events for each day
  const getEventsForDay = (date: string): Event[] => {
    return wizard.weekEvents.filter((event) => {
      const eventDate = new Date(event.start_time).toISOString().split("T")[0];
      return eventDate === date;
    });
  };

  // Get dates for the week
  const getWeekDates = (): string[] => {
    if (!wizard.weekOf) return [];
    const start = new Date(wizard.weekOf + "T00:00:00");
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const day = event.active.data.current?.day;
    if (day) {
      setActiveDragDay(day);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragDay(null);

    if (!over) return;

    // Extract day numbers
    const activeDay = active.data.current?.day;
    const overDayMatch = (over.id as string).match(/day-(\d+)/);
    const overDay = overDayMatch ? parseInt(overDayMatch[1]) : null;

    if (activeDay && overDay && activeDay !== overDay) {
      wizard.swapMeals(activeDay, overDay);
    }
  };

  // Handle replace meal
  const handleReplaceMeal = async (day: number) => {
    setReplacingDay(day);
    setError(null);
    wizard.setIsReplacingMeal(true);

    try {
      const currentMeal = wizard.proposedMeals.find((m) => m.day === day);
      const usedRecipeIds = wizard.proposedMeals
        .filter((m) => m.recipeId)
        .map((m) => m.recipeId);

      const response = await fetch("/api/weekly-plans/suggest-replacement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day,
          date: currentMeal?.date,
          currentRecipeId: currentMeal?.recipeId,
          excludeRecipeIds: usedRecipeIds,
          events: getEventsForDay(currentMeal?.date || ""),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get replacement");
      }

      const data = await response.json();
      wizard.updateMeal(day, {
        ...data.suggestion,
        day,
        date: currentMeal?.date || "",
        isAiSuggested: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setReplacingDay(null);
      wizard.setIsReplacingMeal(false);
    }
  };

  // Handle continue to groceries
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

  if (!wizard.proposedMeals || wizard.proposedMeals.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const weekDates = getWeekDates();
  const activeMeal = activeDragDay
    ? wizard.proposedMeals.find((m) => m.day === activeDragDay)
    : null;

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
          <span className="text-gray-900">Review</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Review Meal Plan</h1>
        <p className="text-gray-600 mt-1">
          Step 2 of 4: Review and adjust your AI-generated meal plan
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
          <span className="ml-2 text-sm text-emerald-600">Input</span>
        </div>
        <div className="flex-1 h-0.5 bg-emerald-600 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-medium">
            2
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Review</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            3
          </div>
          <span className="ml-2 text-sm text-gray-500">Groceries</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            4
          </div>
          <span className="ml-2 text-sm text-gray-500">Finalize</span>
        </div>
      </div>

      {/* AI explanation */}
      {wizard.aiExplanation && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-purple-900">
                AI Planning Strategy
              </h3>
              <p className="text-sm text-purple-700 mt-1">
                {wizard.aiExplanation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Day slots with drag and drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {weekDates.map((date, index) => {
            const day = index + 1;
            const meal = wizard.proposedMeals.find((m) => m.day === day);
            return (
              <DaySlot
                key={day}
                day={day}
                date={date}
                events={getEventsForDay(date)}
                meal={meal}
                onReplace={handleReplaceMeal}
                isReplacing={replacingDay === day}
                isDraggedOver={false}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeMeal ? <MealDragOverlay meal={activeMeal} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Error message */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex justify-between items-center">
        <Link
          href="/weekly-plans/create/input"
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
        >
          <span>&larr;</span>
          Back to Input
        </Link>
        <button
          onClick={handleContinue}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          Continue to Groceries
          <span className="text-emerald-200">&rarr;</span>
        </button>
      </div>
    </div>
  );
}
