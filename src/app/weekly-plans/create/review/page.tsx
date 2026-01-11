"use client";

import { useState, useEffect, useMemo } from "react";
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
import { useEvents, Event } from "@/contexts/EventsContext";
import { formatDateLocal, getSaturdayOptions, getWeekDates as getWeekDatesUtil } from "@/utils/dates";
import { DAY_NAMES } from "@/constants/calendar";
import { TIME_RATING_LABELS, TIME_RATING_COLORS } from "@/constants/recipes";
import WizardProgress from "@/components/WizardProgress";

const WIZARD_STEPS = [
  { id: "review", label: "Meals", href: "/weekly-plans/create/review" },
  { id: "staples", label: "Staples", href: "/weekly-plans/create/staples" },
  { id: "events", label: "Events", href: "/weekly-plans/create/events" },
  { id: "groceries", label: "Groceries", href: "/weekly-plans/create/groceries" },
];

interface ExistingPlan {
  id: string;
  week_of: string;
}

// Filter events for a specific week
function getEventsForWeek(events: Event[], weekOf: string): Event[] {
  const weekDates = getWeekDatesUtil(weekOf);
  const startOfWeek = weekDates[0];
  const endOfWeek = new Date(weekDates[6]);
  endOfWeek.setHours(23, 59, 59, 999);

  return events.filter((event) => {
    const eventDate = new Date(event.start_time);
    return eventDate >= startOfWeek && eventDate <= endOfWeek;
  });
}

// Format Saturday option for display
function formatSaturdayOption(dateStr: string, existingPlans: ExistingPlan[]): string {
  const date = new Date(dateStr + "T00:00:00");
  const endDate = new Date(date);
  endDate.setDate(date.getDate() + 6);

  const hasPlan = existingPlans.some(p => p.week_of === dateStr);

  const label = `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return hasPlan ? `${label} (Plan exists)` : label;
}

interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

interface Recipe {
  id: string;
  name: string;
  time_rating: number | null;
  category: string | null;
  cuisine: string | null;
}

interface DraggableMealProps {
  meal: ProposedMeal;
  onReplace: (mealId: string) => void;
  onRemove: (mealId: string) => void;
  onAssign: (mealId: string, userId: string | undefined) => void;
  onMove: (meal: ProposedMeal) => void;
  onPickRecipe: (mealId: string) => void;
  isReplacing: boolean;
  canRemove: boolean;
  householdMembers: HouseholdMember[];
  isMobile: boolean;
}

function DraggableMeal({ meal, onReplace, onRemove, onAssign, onMove, onPickRecipe, isReplacing, canRemove, householdMembers, isMobile }: DraggableMealProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-${meal.mealId}`,
    data: { mealId: meal.mealId, day: meal.day },
    disabled: isMobile, // Disable drag on mobile
  });

  const timeRating = meal.recipeTimeRating
    ? { label: TIME_RATING_LABELS[meal.recipeTimeRating], color: TIME_RATING_COLORS[meal.recipeTimeRating] }
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
          {/* Mobile: Move button with proper touch target */}
          {isMobile ? (
            <button
              onClick={() => onMove(meal)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded transition-colors flex-shrink-0 -ml-1"
              title="Move to another day"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>
          ) : (
            /* Desktop: Drag handle */
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0 mt-0.5"
              title="Drag to swap with another meal"
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
          )}

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
            </div>
            {meal.aiReasoning && (
              <p className="text-xs text-gray-500 mt-2 italic">
                &quot;{meal.aiReasoning}&quot;
              </p>
            )}

            {/* User assignment */}
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-gray-500">Cook:</label>
              <select
                value={meal.assignedUserId || ""}
                onChange={(e) => onAssign(meal.mealId, e.target.value || undefined)}
                className={`text-xs px-2 py-1 rounded border ${
                  meal.assignedUserId ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
                } focus:ring-1 focus:ring-emerald-500`}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Assign someone...</option>
                {householdMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onPickRecipe(meal.mealId)}
            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
            title="Choose a recipe"
          >
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
          <button
            onClick={() => onReplace(meal.mealId)}
            disabled={isReplacing}
            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            title="Get new AI suggestion"
          >
            {isReplacing ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
            ) : (
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
            )}
          </button>
          {canRemove && (
            <button
              onClick={() => onRemove(meal.mealId)}
              className="px-2 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
              title="Remove meal"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MealDragOverlay({ meal }: { meal: ProposedMeal }) {
  const timeRating = meal.recipeTimeRating
    ? { label: TIME_RATING_LABELS[meal.recipeTimeRating], color: TIME_RATING_COLORS[meal.recipeTimeRating] }
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
  meals: ProposedMeal[];
  onReplace: (mealId: string) => void;
  onRemove: (mealId: string) => void;
  onAssign: (mealId: string, userId: string | undefined) => void;
  onMove: (meal: ProposedMeal) => void;
  onPickRecipe: (mealId: string) => void;
  onAddMealWithAI: (day: number, date: string) => void;
  onAddRecipe: (day: number, date: string, recipe: Recipe) => void;
  replacingMealId: string | null;
  isDraggedOver: boolean;
  householdMembers: HouseholdMember[];
  isMobile: boolean;
  isAddingMeal: boolean;
  recipes: Recipe[];
  usedRecipeIds: string[];
}

function DaySlot({
  day,
  date,
  events,
  meals,
  onReplace,
  onRemove,
  onAssign,
  onMove,
  onPickRecipe,
  onAddMealWithAI,
  onAddRecipe,
  replacingMealId,
  isDraggedOver,
  householdMembers,
  isMobile,
  isAddingMeal,
  recipes,
  usedRecipeIds,
}: DaySlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day}`,
    data: { day },
  });
  const [recipeSearch, setRecipeSearch] = useState("");

  const dayName = DAY_NAMES[day - 1];
  const isBusy = events.length > 0;
  const isHighlighted = isOver || isDraggedOver;

  // Filter recipes based on search
  const filteredRecipes = recipeSearch.trim()
    ? recipes.filter((recipe) =>
        recipe.name.toLowerCase().includes(recipeSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-colors ${
        isHighlighted ? "border-emerald-500 bg-emerald-50/30" : "border-gray-200"
      }`}
    >
      {/* Day header - always grey */}
      <div className="px-4 py-2 bg-gray-50 border-b">
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
          <div className="flex items-center gap-2">
            {isBusy && (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                {events.length} event{events.length > 1 ? "s" : ""}
              </span>
            )}
            {meals.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                {meals.length} dinner{meals.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Events for the day - individual events highlighted */}
      {events.length > 0 && (
        <div className="px-4 py-2 border-b">
          <div className="space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center gap-1"
              >
                <svg className="w-3 h-3 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">{event.title}</span>
                <span className="text-amber-600">
                  {event.all_day
                    ? "(All day)"
                    : `at ${new Date(event.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meals content - multiple meals supported */}
      <div className="p-3 space-y-2">
        {meals.length > 0 ? (
          <>
            {meals.map((meal) => (
              <DraggableMeal
                key={meal.mealId}
                meal={meal}
                onReplace={onReplace}
                onRemove={onRemove}
                onAssign={onAssign}
                onMove={onMove}
                onPickRecipe={onPickRecipe}
                isReplacing={replacingMealId === meal.mealId}
                canRemove={true}
                householdMembers={householdMembers}
                isMobile={isMobile}
              />
            ))}
            {/* Add another meal - inline search */}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Add another dinner..."
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {filteredRecipes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {filteredRecipes.map((recipe) => {
                    const isUsed = usedRecipeIds.includes(recipe.id);
                    const timeRating = recipe.time_rating
                      ? { label: TIME_RATING_LABELS[recipe.time_rating], color: TIME_RATING_COLORS[recipe.time_rating] }
                      : null;
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => {
                          onAddRecipe(day, date, recipe);
                          setRecipeSearch("");
                        }}
                        disabled={isUsed}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                          isUsed
                            ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                            : "hover:bg-emerald-50 text-gray-900"
                        }`}
                      >
                        <span className="truncate">{recipe.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {timeRating && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${timeRating.color}`}>
                              {timeRating.label}
                            </span>
                          )}
                          {isUsed && (
                            <span className="text-xs text-gray-400">In use</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state - inline recipe search */
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-3">
            {/* Search input */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search recipes..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Recipe results */}
            {filteredRecipes.length > 0 && (
              <div className="mt-2 space-y-1">
                {filteredRecipes.map((recipe) => {
                  const isUsed = usedRecipeIds.includes(recipe.id);
                  const timeRating = recipe.time_rating
                    ? { label: TIME_RATING_LABELS[recipe.time_rating], color: TIME_RATING_COLORS[recipe.time_rating] }
                    : null;
                  return (
                    <button
                      key={recipe.id}
                      onClick={() => {
                        onAddRecipe(day, date, recipe);
                        setRecipeSearch("");
                      }}
                      disabled={isUsed}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        isUsed
                          ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                          : "hover:bg-emerald-50 text-gray-900"
                      }`}
                    >
                      <span className="truncate">{recipe.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {timeRating && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${timeRating.color}`}>
                            {timeRating.label}
                          </span>
                        )}
                        {isUsed && (
                          <span className="text-xs text-gray-400">In use</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* AI suggestion button */}
            <button
              onClick={() => onAddMealWithAI(day, date)}
              disabled={isAddingMeal}
              className="w-full mt-2 py-2.5 px-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5 min-h-[44px] disabled:opacity-50"
            >
              {isAddingMeal ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              AI suggestion
            </button>
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
  const { events: allEvents } = useEvents();
  const isMobile = useIsMobile();

  const [replacingMealId, setReplacingMealId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDragMealId, setActiveDragMealId] = useState<string | null>(null);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [movingMeal, setMovingMeal] = useState<ProposedMeal | null>(null);
  const [pickingRecipeForMealId, setPickingRecipeForMealId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [existingPlans, setExistingPlans] = useState<ExistingPlan[]>([]);

  // Saturday options for dropdown
  const saturdayOptions = useMemo(() => getSaturdayOptions(), []);

  // Get used recipe IDs to show which are already planned
  const usedRecipeIds = useMemo(() => {
    return wizard.proposedMeals
      .filter((m) => m.recipeId)
      .map((m) => m.recipeId as string);
  }, [wizard.proposedMeals]);

  // Check if selected week already has a plan
  const selectedWeekHasPlan = existingPlans.some(p => p.week_of === wizard.weekOf);

  // Fetch existing plans
  useEffect(() => {
    const fetchExistingPlans = async () => {
      try {
        const response = await fetch("/api/weekly-plans");
        if (response.ok) {
          const data = await response.json();
          setExistingPlans(data.weeklyPlans || []);
        }
      } catch (error) {
        console.error("Failed to fetch existing plans:", error);
      }
    };
    if (session) {
      fetchExistingPlans();
    }
  }, [session]);

  // Update week events when weekOf changes
  useEffect(() => {
    const weekEvents = getEventsForWeek(allEvents, wizard.weekOf);
    wizard.setWeekEvents(weekEvents);
  }, [allEvents, wizard.weekOf]);

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

  // Fetch recipes on page load for inline search
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const response = await fetch("/api/recipes");
        if (response.ok) {
          const data = await response.json();
          setRecipes(data.recipes || []);
        }
      } catch (err) {
        console.error("Failed to fetch recipes:", err);
      }
    };
    if (session) {
      fetchRecipes();
    }
  }, [session]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Get events for each day
  const getEventsForDay = (date: string): Event[] => {
    return wizard.weekEvents.filter((event) => {
      const eventDate = formatDateLocal(new Date(event.start_time));
      return eventDate === date;
    });
  };

  // Get meals for each day
  const getMealsForDay = (day: number): ProposedMeal[] => {
    return wizard.proposedMeals
      .filter((m) => m.day === day)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  };

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

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const mealId = event.active.data.current?.mealId;
    if (mealId) {
      setActiveDragMealId(mealId);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragMealId(null);

    if (!over) return;

    const activeMealId = active.data.current?.mealId;
    const overId = over.id as string;

    // If dropping on another meal, swap them
    if (overId.startsWith("meal-")) {
      const overMealId = overId.replace("meal-", "");
      if (activeMealId && overMealId && activeMealId !== overMealId) {
        wizard.swapMealsById(activeMealId, overMealId);
      }
    }
    // If dropping on a day slot, move the meal to that day
    else if (overId.startsWith("day-")) {
      const overDayMatch = overId.match(/day-(\d+)/);
      const overDay = overDayMatch ? parseInt(overDayMatch[1]) : null;
      const activeMeal = wizard.proposedMeals.find((m) => m.mealId === activeMealId);

      if (activeMeal && overDay && activeMeal.day !== overDay) {
        const weekDates = getWeekDates();
        const newDate = weekDates[overDay - 1];
        wizard.updateMealById(activeMealId, {
          day: overDay,
          date: newDate,
          isAiSuggested: false,
        });
      }
    }
  };

  // Handle replace meal
  const handleReplaceMeal = async (mealId: string) => {
    setReplacingMealId(mealId);
    setError(null);
    wizard.setIsReplacingMeal(true);

    try {
      const currentMeal = wizard.proposedMeals.find((m) => m.mealId === mealId);
      if (!currentMeal) return;

      const usedRecipeIds = wizard.proposedMeals
        .filter((m) => m.recipeId)
        .map((m) => m.recipeId);

      const response = await fetch("/api/weekly-plans/suggest-replacement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: currentMeal.day,
          date: currentMeal.date,
          currentRecipeId: currentMeal.recipeId,
          excludeRecipeIds: usedRecipeIds,
          events: getEventsForDay(currentMeal.date || ""),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get replacement");
      }

      const data = await response.json();
      wizard.updateMealById(mealId, {
        recipeId: data.suggestion.recipeId,
        recipeName: data.suggestion.recipeName,
        recipeTimeRating: data.suggestion.recipeTimeRating,
        aiReasoning: data.suggestion.aiReasoning,
        isAiSuggested: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setReplacingMealId(null);
      wizard.setIsReplacingMeal(false);
    }
  };

  // Handle remove meal
  const handleRemoveMeal = (mealId: string) => {
    wizard.removeMeal(mealId);
  };

  // Handle assign user to meal
  const handleAssignUser = (mealId: string, userId: string | undefined) => {
    wizard.updateMealById(mealId, { assignedUserId: userId });
  };

  // Handle opening move modal
  const handleOpenMoveModal = (meal: ProposedMeal) => {
    setMovingMeal(meal);
  };

  // Handle moving meal to a new day
  const handleMoveMealToDay = (targetDay: number) => {
    if (!movingMeal) return;
    const weekDates = getWeekDates();
    const newDate = weekDates[targetDay - 1];
    wizard.updateMealById(movingMeal.mealId, {
      day: targetDay,
      date: newDate,
      isAiSuggested: false,
    });
    setMovingMeal(null);
  };

  // Handle opening recipe picker for replacing an existing meal
  const handleOpenRecipePicker = async (mealId: string) => {
    setPickingRecipeForMealId(mealId);
    setRecipeSearch("");
  };

  // Handle selecting a recipe from the picker (for replacing existing meal)
  const handleSelectRecipe = (recipe: Recipe) => {
    if (!pickingRecipeForMealId) return;
    wizard.updateMealById(pickingRecipeForMealId, {
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeTimeRating: recipe.time_rating ?? undefined,
      aiReasoning: undefined,
      isAiSuggested: false,
    });
    setPickingRecipeForMealId(null);
  };

  // Handle adding a recipe directly to a day (from inline search)
  const handleAddRecipe = (day: number, date: string, recipe: Recipe) => {
    wizard.addMealToDay(day, date, {
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeTimeRating: recipe.time_rating ?? undefined,
      isAiSuggested: false,
    });
  };

  // Filter recipes based on search
  const filteredRecipes = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  // Handle add meal to day
  const handleAddMeal = async (day: number, date: string) => {
    setIsAddingMeal(true);
    setError(null);

    try {
      const usedRecipeIds = wizard.proposedMeals
        .filter((m) => m.recipeId)
        .map((m) => m.recipeId);

      const response = await fetch("/api/weekly-plans/suggest-replacement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day,
          date,
          excludeRecipeIds: usedRecipeIds,
          events: getEventsForDay(date),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get suggestion");
      }

      const data = await response.json();
      wizard.addMealToDay(day, date, {
        recipeId: data.suggestion.recipeId,
        recipeName: data.suggestion.recipeName,
        recipeTimeRating: data.suggestion.recipeTimeRating,
        aiReasoning: data.suggestion.aiReasoning,
        isAiSuggested: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAddingMeal(false);
    }
  };

  // Check if all meals have been assigned
  const unassignedMeals = wizard.proposedMeals.filter((m) => !m.assignedUserId);
  const allMealsAssigned = unassignedMeals.length === 0;

  // Handle continue - now goes to staples step
  const handleContinue = () => {
    if (selectedWeekHasPlan) {
      setError("A plan already exists for this week. Please select a different week.");
      return;
    }
    if (wizard.proposedMeals.length === 0) {
      setError("Please add at least one meal before continuing.");
      return;
    }
    if (!allMealsAssigned) {
      setError(`Please assign a cook to all ${unassignedMeals.length} unassigned meal(s) before continuing.`);
      return;
    }
    setError(null);
    // Always go to staples step next
    router.push("/weekly-plans/create/staples");
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to continue.</p>
      </div>
    );
  }

  const weekDates = getWeekDates();
  const activeMeal = activeDragMealId
    ? wizard.proposedMeals.find((m) => m.mealId === activeDragMealId)
    : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Restore Session Modal */}
      {wizard.showRestoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Resume Previous Plan?</h3>
                <p className="text-sm text-gray-500">You have an unfinished meal plan</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              We found a meal plan you were working on. Would you like to continue where you left off?
            </p>
            <div className="flex gap-3">
              <button
                onClick={wizard.discardSavedSession}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                Start Fresh
              </button>
              <button
                onClick={wizard.restoreSession}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors min-h-[44px]"
              >
                Resume Plan
              </button>
            </div>
          </div>
        </div>
      )}

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
          <span className="text-gray-900">Create New Plan</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Create Weekly Meal Plan</h1>
        <WizardProgress steps={WIZARD_STEPS} currentStep="review" />
        <p className="text-gray-600">
          Plan meals and assign who&apos;s cooking
        </p>
      </div>

      {/* Progress indicator - 4 steps */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-medium">
            1
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Meals</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            2
          </div>
          <span className="ml-2 text-sm text-gray-500">Staples</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            3
          </div>
          <span className="ml-2 text-sm text-gray-500">Events</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            4
          </div>
          <span className="ml-2 text-sm text-gray-500">Groceries</span>
        </div>
      </div>

      {/* Week selector */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Week
        </label>
        <select
          value={wizard.weekOf}
          onChange={(e) => wizard.setWeekOf(e.target.value)}
          className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
            selectedWeekHasPlan ? "border-amber-300 bg-amber-50" : "border-gray-300"
          }`}
        >
          {saturdayOptions.map((saturday) => (
            <option key={saturday} value={saturday}>
              {formatSaturdayOption(saturday, existingPlans)}
            </option>
          ))}
        </select>
        {selectedWeekHasPlan && (
          <p className="text-sm text-amber-600 mt-2">
            A plan already exists for this week. Select a different week or edit the existing plan.
          </p>
        )}
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
            const meals = getMealsForDay(day);
            return (
              <DaySlot
                key={day}
                day={day}
                date={date}
                events={getEventsForDay(date)}
                meals={meals}
                onReplace={handleReplaceMeal}
                onRemove={handleRemoveMeal}
                onAssign={handleAssignUser}
                onMove={handleOpenMoveModal}
                onPickRecipe={handleOpenRecipePicker}
                onAddMealWithAI={handleAddMeal}
                onAddRecipe={handleAddRecipe}
                replacingMealId={replacingMealId}
                isDraggedOver={false}
                householdMembers={householdMembers}
                isMobile={isMobile}
                isAddingMeal={isAddingMeal}
                recipes={recipes}
                usedRecipeIds={usedRecipeIds}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeMeal ? <MealDragOverlay meal={activeMeal} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Loading overlay for adding meal */}
      {isAddingMeal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
            <span className="text-gray-700">Getting AI suggestion...</span>
          </div>
        </div>
      )}

      {/* Move meal modal - mobile only */}
      {movingMeal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom duration-200 md:animate-none">
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Move Meal</h3>
                <button
                  onClick={() => setMovingMeal(null)}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Move &quot;{movingMeal.recipeName}&quot; to:
              </p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-2">
                {weekDates.map((date, index) => {
                  const day = index + 1;
                  const isCurrentDay = movingMeal.day === day;
                  const dayLabel = DAY_NAMES[index];
                  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <button
                      key={day}
                      onClick={() => handleMoveMealToDay(day)}
                      disabled={isCurrentDay}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg min-h-[52px] transition-colors ${
                        isCurrentDay
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-gray-50 hover:bg-emerald-50 active:bg-emerald-100 text-gray-900"
                      }`}
                    >
                      <span className="font-medium">{dayLabel}</span>
                      <span className="text-sm text-gray-500">{dateLabel}</span>
                      {isCurrentDay && (
                        <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Current</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50">
              <button
                onClick={() => setMovingMeal(null)}
                className="w-full py-3 text-gray-600 hover:text-gray-800 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe picker modal - for replacing existing meals */}
      {pickingRecipeForMealId && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom duration-200 md:animate-none max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Choose a Recipe</h3>
                <button
                  onClick={() => setPickingRecipeForMealId(null)}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Search recipes..."
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {recipes.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                </div>
              ) : filteredRecipes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {recipeSearch ? "No recipes match your search" : "No recipes found"}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredRecipes.map((recipe) => {
                    const timeRating = recipe.time_rating
                      ? { label: TIME_RATING_LABELS[recipe.time_rating], color: TIME_RATING_COLORS[recipe.time_rating] }
                      : null;
                    const isUsed = wizard.proposedMeals.some((m) => m.recipeId === recipe.id);

                    return (
                      <button
                        key={recipe.id}
                        onClick={() => handleSelectRecipe(recipe)}
                        disabled={isUsed}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                          isUsed
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "hover:bg-emerald-50 active:bg-emerald-100"
                        }`}
                      >
                        <span className="font-medium truncate">{recipe.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {timeRating && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${timeRating.color}`}>
                              {timeRating.label}
                            </span>
                          )}
                          {isUsed && (
                            <span className="text-xs text-gray-400">In use</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setPickingRecipeForMealId(null)}
                className="w-full py-3 text-gray-600 hover:text-gray-800 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Status messages */}
      {wizard.proposedMeals.length === 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-blue-800">
            Search for a recipe on any day or use &quot;AI suggestion&quot; to start planning your meals.
          </p>
        </div>
      )}
      {wizard.proposedMeals.length > 0 && !allMealsAssigned && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-amber-800">
            <span className="font-medium">{unassignedMeals.length} meal{unassignedMeals.length > 1 ? "s" : ""}</span> still need{unassignedMeals.length === 1 ? "s" : ""} a cook assigned. Use the &quot;Cook&quot; dropdown on each meal.
          </p>
        </div>
      )}

      {/* Action buttons - sticky on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-safe md:relative md:border-0 md:p-0 md:mt-8 z-20">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <Link
            href="/weekly-plans"
            className="px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            Cancel
          </Link>
          <button
            onClick={handleContinue}
            disabled={!allMealsAssigned || wizard.proposedMeals.length === 0 || selectedWeekHasPlan}
            className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 min-h-[44px] ${
              allMealsAssigned && wizard.proposedMeals.length > 0 && !selectedWeekHasPlan
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Continue
            <span className={allMealsAssigned && wizard.proposedMeals.length > 0 && !selectedWeekHasPlan ? "text-emerald-200" : "text-gray-400"}>&rarr;</span>
          </button>
        </div>
      </div>

      {/* Padding for fixed bottom bar on mobile */}
      <div className="h-24 md:hidden"></div>
    </div>
  );
}
