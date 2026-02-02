"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DAY_NAMES } from "@/constants/calendar";
import { getDepartmentSortIndexForStore } from "@/constants/grocery";
import { WeeklyPlanDetailSkeleton } from "@/components/Skeleton";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

interface Recipe {
  id: string;
  name: string;
  time_rating?: number;
  yields_leftovers?: boolean;
}

interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

interface AssignedUser {
  id: string;
  name: string;
  email: string;
}

interface Meal {
  id: string;
  day: number;
  meal_type: string;
  custom_meal_name?: string;
  is_leftover: boolean;
  notes?: string;
  recipes?: Recipe;
  assigned_user_id?: string;
  assigned_user?: AssignedUser;
}

interface WeekEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  all_day: boolean;
  location?: string;
  assigned_users: AssignedUser[];
}

interface Ingredient {
  id: string;
  name: string;
  department?: string;
  store_id?: string;
  store_name?: string;
}

interface RecipeBreakdown {
  recipe_id: string;
  recipe_name: string;
  quantity: number | null;
  unit: string | null;
}

interface GroceryItem {
  id: string;
  quantity?: number;
  unit?: string;
  checked: boolean;
  is_staple?: boolean;
  ingredients: Ingredient | null;
  recipe_breakdown?: RecipeBreakdown[];
}

interface GroceryList {
  id: string;
  notes?: string;
  grocery_items: GroceryItem[];
}

interface Store {
  id: string;
  name: string;
  department_order?: string[] | null;
}

interface WeeklyPlan {
  id: string;
  week_of: string;
  notes?: string;
  meals: Meal[];
  grocery_list?: GroceryList[];
  events?: WeekEvent[];
  created_at: string;
}

type TabType = "dinner" | "grocery" | "events";

// iCal-style date icon component
function DateIcon({ dayIndex, weekOf, isHighlighted = false }: { dayIndex: number; weekOf: string; isHighlighted?: boolean }) {
  const date = new Date(weekOf + "T00:00:00");
  date.setDate(date.getDate() + dayIndex);
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

// Assignee Dropdown Component
function AssigneeDropdown({
  currentAssignee,
  members,
  onSelect,
  isUpdating,
}: {
  currentAssignee?: AssignedUser;
  members: HouseholdMember[];
  onSelect: (userId: string | null) => void;
  isUpdating: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !isUpdating && setIsOpen(!isOpen)}
        disabled={isUpdating}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex items-center gap-1.5 px-3 py-2 sm:px-2 sm:py-1 rounded-lg text-sm transition-all ${
          isUpdating ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 active:bg-gray-200 cursor-pointer"
        } ${currentAssignee ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
      >
        {currentAssignee ? (
          <span className="font-medium">{currentAssignee.name || currentAssignee.email.split("@")[0]}</span>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Assign</span>
          </>
        )}
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 sm:left-auto sm:right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] max-w-[calc(100vw-2rem)]" role="listbox">
          {currentAssignee && (
            <button
              onClick={() => { onSelect(null); setIsOpen(false); }}
              className="w-full px-4 py-3 sm:px-3 sm:py-2 text-left text-sm text-gray-500 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Unassign
            </button>
          )}
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => { onSelect(member.id); setIsOpen(false); }}
              role="option"
              aria-selected={currentAssignee?.id === member.id}
              className={`w-full px-4 py-3 sm:px-3 sm:py-2 text-left text-sm hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2 ${
                currentAssignee?.id === member.id ? "bg-emerald-50 text-emerald-700" : "text-gray-700"
              }`}
            >
              <span>{member.name || member.email.split("@")[0]}</span>
              {currentAssignee?.id === member.id && (
                <svg className="w-4 h-4 ml-auto text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Multi-Select Assignee Dropdown for Events
function MultiAssigneeDropdown({
  assignedUsers,
  members,
  onSelect,
  isUpdating,
}: {
  assignedUsers: AssignedUser[];
  members: HouseholdMember[];
  onSelect: (userIds: string[]) => void;
  isUpdating: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const assignedIds = new Set(assignedUsers.map((u) => u.id));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleUser = (userId: string) => {
    const newIds = assignedIds.has(userId)
      ? Array.from(assignedIds).filter((id) => id !== userId)
      : [...Array.from(assignedIds), userId];
    onSelect(newIds);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !isUpdating && setIsOpen(!isOpen)}
        disabled={isUpdating}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex items-center gap-1 px-3 py-2 sm:px-2 sm:py-1 rounded-lg text-sm transition-all ${
          isUpdating ? "opacity-50 cursor-not-allowed" : "hover:bg-emerald-100 active:bg-emerald-200 cursor-pointer"
        } ${assignedUsers.length > 0 ? "bg-emerald-50" : "bg-gray-100"}`}
      >
        {assignedUsers.length > 0 ? (
          <span className="text-emerald-700 font-medium">
            {assignedUsers.map((u) => u.name || u.email.split("@")[0]).join(", ")}
          </span>
        ) : (
          <span className="text-gray-500 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Assign
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 sm:left-auto sm:right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] max-w-[calc(100vw-2rem)]" role="listbox">
          <div className="px-4 py-2 sm:px-3 sm:py-1.5 text-xs font-medium text-gray-500 border-b">Select attendees</div>
          {members.map((member) => {
            const isAssigned = assignedIds.has(member.id);
            return (
              <button
                key={member.id}
                onClick={() => toggleUser(member.id)}
                role="option"
                aria-selected={isAssigned}
                className={`w-full px-4 py-3 sm:px-3 sm:py-2 text-left text-sm hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3 sm:gap-2 ${
                  isAssigned ? "bg-emerald-50" : ""
                }`}
              >
                <span className={`w-5 h-5 sm:w-4 sm:h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  isAssigned ? "bg-emerald-600 border-emerald-600" : "border-gray-300"
                }`}>
                  {isAssigned && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <span className={isAssigned ? "text-emerald-700 font-medium" : "text-gray-700"}>
                  {member.name || member.email.split("@")[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Draggable Meal Component
function DraggableMeal({
  meal,
  children,
}: {
  meal: Meal;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: meal.id,
    data: { meal },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

// Droppable Day Zone Component
function DroppableDay({
  dayIndex,
  children,
  isOver,
}: {
  dayIndex: number;
  children: React.ReactNode;
  isOver?: boolean;
}) {
  const { setNodeRef, isOver: isOverDroppable } = useDroppable({
    id: `day-${dayIndex}`,
    data: { day: dayIndex },
  });

  const showHighlight = isOver ?? isOverDroppable;

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors rounded-lg ${showHighlight ? "bg-emerald-100 ring-2 ring-emerald-400" : ""}`}
    >
      {children}
    </div>
  );
}

export default function WeeklyPlanDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tabParam = searchParams.get("tab");
  const initialTab: TabType = tabParam === "dinner" ? "dinner" : tabParam === "events" ? "events" : "grocery";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [updatingMeals, setUpdatingMeals] = useState<Set<string>>(new Set());
  const [updatingEvents, setUpdatingEvents] = useState<Set<string>>(new Set());
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [activeDragMeal, setActiveDragMeal] = useState<Meal | null>(null);

  // DnD sensors - only activate on desktop with sufficient drag distance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const meal = weeklyPlan?.meals.find((m) => m.id === active.id);
    if (meal) {
      setActiveDragMeal(meal);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragMeal(null);

    if (!over) return;

    // Extract the day from the droppable id (format: "day-{index}")
    const overIdStr = String(over.id);
    if (!overIdStr.startsWith("day-")) return;

    const newDay = parseInt(overIdStr.replace("day-", "")) + 1; // +1 because days are 1-indexed
    const mealId = String(active.id);

    handleMoveMeal(mealId, newDay);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!params.id) return;

      try {
        const [planResponse, membersResponse, storesResponse] = await Promise.all([
          fetch(`/api/weekly-plans/${params.id}`),
          fetch("/api/household/members"),
          fetch("/api/stores"),
        ]);

        if (planResponse.ok) {
          const data = await planResponse.json();
          setWeeklyPlan(data.weeklyPlan);
        } else {
          setError("Weekly plan not found");
        }

        if (membersResponse.ok) {
          const data = await membersResponse.json();
          setHouseholdMembers(data.members || []);
        }

        if (storesResponse.ok) {
          const data = await storesResponse.json();
          setStores(data.stores || []);
        }
      } catch {
        setError("Failed to load weekly plan");
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchData();
    }
  }, [session, params.id]);

  const handleSyncToCalendar = async () => {
    setIsSyncingCalendar(true);
    setSyncMessage({ type: "info", text: "Syncing meals to Google Calendar..." });

    try {
      const response = await fetch(`/api/weekly-plans/${params.id}/sync-calendar`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        if (data.failed > 0 && data.created === 0) {
          setSyncMessage({
            type: "error",
            text: `Failed to sync ${data.failed} meal${data.failed !== 1 ? "s" : ""}. Please sign out and sign back in to refresh your Google access.`,
          });
        } else if (data.created === 0 && data.skipped > 0) {
          setSyncMessage({
            type: "info",
            text: "All meals are already synced to calendar.",
          });
        } else if (data.created > 0) {
          setSyncMessage({
            type: "success",
            text: `Synced ${data.created} meal${data.created !== 1 ? "s" : ""} to calendar.${data.failed > 0 ? ` ${data.failed} failed.` : ""}`,
          });
        } else {
          setSyncMessage({
            type: "info",
            text: "No meals to sync.",
          });
        }
      } else {
        setSyncMessage({
          type: "error",
          text: data.error || "Failed to sync to calendar.",
        });
      }
    } catch {
      setSyncMessage({
        type: "error",
        text: "Failed to sync to calendar. Please try again.",
      });
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this weekly plan? This will also delete all associated meals and grocery lists.")) return;

    try {
      const response = await fetch(`/api/weekly-plans/${params.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/weekly-plans");
      } else {
        alert("Failed to delete weekly plan");
      }
    } catch {
      alert("Failed to delete weekly plan");
    }
  };

  const handleMealAssigneeChange = async (mealId: string, userId: string | null) => {
    setUpdatingMeals((prev) => new Set(prev).add(mealId));

    // Optimistic update
    setWeeklyPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((meal) => {
          if (meal.id === mealId) {
            const assignedUser = userId ? householdMembers.find((m) => m.id === userId) : undefined;
            return {
              ...meal,
              assigned_user_id: userId || undefined,
              assigned_user: assignedUser ? { id: assignedUser.id, name: assignedUser.name, email: assignedUser.email } : undefined,
            };
          }
          return meal;
        }),
      };
    });

    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_user_id: userId }),
      });

      if (!response.ok) {
        // Revert on error - refetch
        const planResponse = await fetch(`/api/weekly-plans/${params.id}`);
        if (planResponse.ok) {
          const data = await planResponse.json();
          setWeeklyPlan(data.weeklyPlan);
        }
      }
    } catch {
      // Revert on error - refetch
      const planResponse = await fetch(`/api/weekly-plans/${params.id}`);
      if (planResponse.ok) {
        const data = await planResponse.json();
        setWeeklyPlan(data.weeklyPlan);
      }
    } finally {
      setUpdatingMeals((prev) => {
        const next = new Set(prev);
        next.delete(mealId);
        return next;
      });
    }
  };

  const handleMoveMeal = async (mealId: string, newDay: number) => {
    // Find the meal to get its current day
    const meal = weeklyPlan?.meals.find((m) => m.id === mealId);
    if (!meal || meal.day === newDay) return;

    setUpdatingMeals((prev) => new Set(prev).add(mealId));

    // Optimistic update
    setWeeklyPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((m) =>
          m.id === mealId ? { ...m, day: newDay } : m
        ),
      };
    });

    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: newDay }),
      });

      if (!response.ok) {
        // Revert on error - refetch
        const planResponse = await fetch(`/api/weekly-plans/${params.id}`);
        if (planResponse.ok) {
          const data = await planResponse.json();
          setWeeklyPlan(data.weeklyPlan);
        }
      }
    } catch {
      // Revert on error - refetch
      const planResponse = await fetch(`/api/weekly-plans/${params.id}`);
      if (planResponse.ok) {
        const data = await planResponse.json();
        setWeeklyPlan(data.weeklyPlan);
      }
    } finally {
      setUpdatingMeals((prev) => {
        const next = new Set(prev);
        next.delete(mealId);
        return next;
      });
    }
  };

  const handleEventAssigneesChange = async (eventId: string, userIds: string[]) => {
    setUpdatingEvents((prev) => new Set(prev).add(eventId));

    // Optimistic update
    setWeeklyPlan((prev) => {
      if (!prev || !prev.events) return prev;
      return {
        ...prev,
        events: prev.events.map((event) => {
          if (event.id === eventId) {
            const assignedUsers = userIds
              .map((id) => householdMembers.find((m) => m.id === id))
              .filter(Boolean)
              .map((m) => ({ id: m!.id, name: m!.name, email: m!.email }));
            return { ...event, assigned_users: assignedUsers };
          }
          return event;
        }),
      };
    });

    try {
      const response = await fetch(`/api/weekly-plans/${params.id}/event-assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, user_ids: userIds }),
      });

      if (!response.ok) {
        // Revert on error - refetch
        const planResponse = await fetch(`/api/weekly-plans/${params.id}`);
        if (planResponse.ok) {
          const data = await planResponse.json();
          setWeeklyPlan(data.weeklyPlan);
        }
      }
    } catch {
      // Revert on error
      const planResponse = await fetch(`/api/weekly-plans/${params.id}`);
      if (planResponse.ok) {
        const data = await planResponse.json();
        setWeeklyPlan(data.weeklyPlan);
      }
    } finally {
      setUpdatingEvents((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const handleToggleGroceryItem = async (itemId: string, currentChecked: boolean) => {
    if (updatingItems.has(itemId)) return;

    setUpdatingItems((prev) => new Set(prev).add(itemId));

    setWeeklyPlan((prev) => {
      if (!prev || !prev.grocery_list?.[0]) return prev;
      return {
        ...prev,
        grocery_list: [
          {
            ...prev.grocery_list[0],
            grocery_items: prev.grocery_list[0].grocery_items.map((item) =>
              item.id === itemId ? { ...item, checked: !currentChecked } : item
            ),
          },
        ],
      };
    });

    try {
      const response = await fetch(`/api/grocery-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: !currentChecked }),
      });

      if (!response.ok) {
        setWeeklyPlan((prev) => {
          if (!prev || !prev.grocery_list?.[0]) return prev;
          return {
            ...prev,
            grocery_list: [
              {
                ...prev.grocery_list[0],
                grocery_items: prev.grocery_list[0].grocery_items.map((item) =>
                  item.id === itemId ? { ...item, checked: currentChecked } : item
                ),
              },
            ],
          };
        });
      }
    } catch {
      setWeeklyPlan((prev) => {
        if (!prev || !prev.grocery_list?.[0]) return prev;
        return {
          ...prev,
          grocery_list: [
            {
              ...prev.grocery_list[0],
              grocery_items: prev.grocery_list[0].grocery_items.map((item) =>
                item.id === itemId ? { ...item, checked: currentChecked } : item
              ),
            },
          ],
        };
      });
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleRegenerateGroceryList = async () => {
    setShowRegenerateConfirm(false);
    setIsRegenerating(true);

    try {
      const response = await fetch(`/api/weekly-plans/${params.id}/regenerate-grocery-list`, {
        method: "POST",
      });

      if (response.ok) {
        // Refetch the full weekly plan data to get updated grocery list with recipe breakdown
        const planResponse = await fetch(`/api/weekly-plans/${params.id}`);
        if (planResponse.ok) {
          const data = await planResponse.json();
          setWeeklyPlan(data.weeklyPlan);
        }
      } else {
        const data = await response.json();
        alert(data.error || "Failed to regenerate grocery list");
      }
    } catch {
      alert("Failed to regenerate grocery list. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const formatWeekOf = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 6);

    return `${date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    })} - ${endDate.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  };

  const getMealsForDay = (day: number, mealType: string = "dinner") => {
    return weeklyPlan?.meals.filter((m) => m.day === day && m.meal_type === mealType) || [];
  };

  const getDateForDay = (dayIndex: number) => {
    if (!weeklyPlan) return "";
    const weekOf = new Date(weeklyPlan.week_of + "T00:00:00");
    const date = new Date(weekOf);
    date.setDate(weekOf.getDate() + dayIndex);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const getDayNumber = (dayIndex: number) => {
    if (!weeklyPlan) return "";
    const weekOf = new Date(weeklyPlan.week_of + "T00:00:00");
    const date = new Date(weekOf);
    date.setDate(weekOf.getDate() + dayIndex);
    return date.getDate();
  };

  const isToday = (dayIndex: number) => {
    if (!weeklyPlan) return false;
    const weekOf = new Date(weeklyPlan.week_of + "T00:00:00");
    const date = new Date(weekOf);
    date.setDate(weekOf.getDate() + dayIndex);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const groceryList = weeklyPlan?.grocery_list?.[0];

  // Create a map of store name to store info for quick lookup
  const storeInfoMap = useMemo(() => {
    const map = new Map<string, { sortOrder: number; departmentOrder: string[] | null }>();
    stores.forEach((store, index) => {
      map.set(store.name, {
        sortOrder: index, // Use the index since stores are already ordered by sort_order from API
        departmentOrder: store.department_order || null,
      });
    });
    return map;
  }, [stores]);

  // Group by store, then by department within each store
  const groceryItemsByStoreAndDept = useMemo(() => {
    if (!groceryList?.grocery_items) return new Map<string, Map<string, GroceryItem[]>>();

    // First, group by store
    const byStore = new Map<string, GroceryItem[]>();
    groceryList.grocery_items.forEach((item) => {
      const store = item.ingredients?.store_name || "No Store Assigned";
      if (!byStore.has(store)) {
        byStore.set(store, []);
      }
      byStore.get(store)!.push(item);
    });

    // Then, within each store, group by department
    const result = new Map<string, Map<string, GroceryItem[]>>();
    byStore.forEach((items, storeName) => {
      const byDept = new Map<string, GroceryItem[]>();
      items.forEach((item) => {
        const dept = item.ingredients?.department || "Other";
        if (!byDept.has(dept)) {
          byDept.set(dept, []);
        }
        byDept.get(dept)!.push(item);
      });

      // Sort items within each department by name
      byDept.forEach((deptItems) => {
        deptItems.sort((a, b) => {
          const nameA = a.ingredients?.name || "";
          const nameB = b.ingredients?.name || "";
          return nameA.localeCompare(nameB);
        });
      });

      // Sort departments using store's custom order if available
      const storeInfo = storeInfoMap.get(storeName);
      const sortedDepts = Array.from(byDept.entries()).sort((a, b) => {
        return getDepartmentSortIndexForStore(a[0], storeInfo?.departmentOrder) - getDepartmentSortIndexForStore(b[0], storeInfo?.departmentOrder);
      });

      result.set(storeName, new Map(sortedDepts));
    });

    // Sort stores by their sort_order (No Store Assigned last)
    const sortedStores = Array.from(result.entries()).sort((a, b) => {
      if (a[0] === "No Store Assigned") return 1;
      if (b[0] === "No Store Assigned") return -1;
      const aInfo = storeInfoMap.get(a[0]);
      const bInfo = storeInfoMap.get(b[0]);
      // If store not found in map, put it before "No Store Assigned" but after known stores
      if (aInfo === undefined && bInfo === undefined) return a[0].localeCompare(b[0]);
      if (aInfo === undefined) return 1;
      if (bInfo === undefined) return -1;
      return aInfo.sortOrder - bInfo.sortOrder;
    });

    return new Map(sortedStores);
  }, [groceryList?.grocery_items, storeInfoMap]);

  const checkedCount = groceryList?.grocery_items.filter((i) => i.checked).length || 0;
  const totalCount = groceryList?.grocery_items.length || 0;

  const eventsCount = weeklyPlan?.events?.length || 0;

  const dinnerCount = weeklyPlan?.meals?.filter((m) => m.meal_type === "dinner" && (m.recipes || m.custom_meal_name)).length || 0;

  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getEventsForDay = (dayIndex: number) => {
    if (!weeklyPlan?.events || !weeklyPlan.week_of) return [];
    const weekOf = new Date(weeklyPlan.week_of + "T00:00:00");
    const targetDate = new Date(weekOf);
    targetDate.setDate(weekOf.getDate() + dayIndex);
    const targetDateStr = formatDateLocal(targetDate);

    return weeklyPlan.events.filter((event) => {
      const eventDate = formatDateLocal(new Date(event.start_time));
      return eventDate === targetDateStr;
    });
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view this weekly plan.</p>
      </div>
    );
  }

  if (isLoading) {
    return <WeeklyPlanDetailSkeleton />;
  }

  if (error || !weeklyPlan) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">{error || "Weekly plan not found"}</p>
          <Link href="/weekly-plans" className="text-emerald-600 hover:text-emerald-700 mt-4 inline-block">
            Back to weekly plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/weekly-plans" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1 py-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Weekly Plans
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {formatWeekOf(weeklyPlan.week_of)}
          </h1>
          <button
            onClick={handleDelete}
            className="self-start px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete Plan
          </button>
        </div>
      </div>

      {/* Tabs - scrollable on mobile */}
      <div className="border-b border-gray-200 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide pb-px">
          <button
            onClick={() => setActiveTab("grocery")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "grocery"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="hidden sm:inline">Grocery List</span>
            <span className="sm:hidden">Groceries</span>
            {totalCount > 0 && (
              <span className={`px-1.5 sm:px-2 py-0.5 text-xs rounded-full font-medium ${
                checkedCount === totalCount
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {checkedCount}/{totalCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("dinner")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "dinner"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="hidden sm:inline">Dinner Plans</span>
            <span className="sm:hidden">Dinners</span>
            <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-600">
              {dinnerCount}
            </span>
          </button>
          {eventsCount > 0 && (
            <button
              onClick={() => setActiveTab("events")}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === "events"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Events
              <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700">
                {eventsCount}
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "grocery" ? (
        <div className="space-y-4">
          {!groceryList || groceryList.grocery_items.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-gray-500 mb-4">No grocery list for this week.</p>
              {weeklyPlan.meals?.some((m) => m.recipes) && (
                <button
                  onClick={handleRegenerateGroceryList}
                  disabled={isRegenerating}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRegenerating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Generate Grocery List
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 px-1">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {checkedCount} of {totalCount} items
                </span>
                <button
                  onClick={() => setShowRegenerateConfirm(true)}
                  disabled={isRegenerating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Regenerate grocery list from current recipes"
                >
                  {isRegenerating ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              </div>

              {/* Regenerate Confirmation Dialog */}
              {showRegenerateConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Regenerate Grocery List?</h3>
                    <p className="text-gray-600 mb-6">
                      This will replace all grocery items, including any you&apos;ve already checked off. The list will be regenerated based on the current dinner recipes.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowRegenerateConfirm(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRegenerateGroceryList}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {Array.from(groceryItemsByStoreAndDept.entries()).map(([store, deptMap]) => {
                  const allStoreItems = Array.from(deptMap.values()).flat();
                  const storeCheckedCount = allStoreItems.filter((i) => i.checked).length;
                  const allStoreChecked = storeCheckedCount === allStoreItems.length;

                  return (
                    <div key={store} className="bg-white rounded-xl shadow-sm">
                      {/* Store Header - Sticky */}
                      <div className={`px-4 py-3 border-b border-l-4 flex items-center justify-between sticky top-0 z-20 rounded-t-xl ${allStoreChecked ? "bg-emerald-100 border-l-emerald-500" : "bg-sky-100 border-l-sky-500"}`}>
                        <div className="flex items-center gap-2">
                          <svg className={`w-5 h-5 ${allStoreChecked ? "text-emerald-600" : "text-sky-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <h3 className={`font-semibold ${allStoreChecked ? "text-emerald-700" : "text-sky-900"}`}>
                            {store}
                          </h3>
                        </div>
                        <span className={`text-sm font-medium ${allStoreChecked ? "text-emerald-600" : "text-sky-700"}`}>
                          {storeCheckedCount}/{allStoreItems.length}
                        </span>
                      </div>

                      {/* Departments within Store */}
                      {Array.from(deptMap.entries()).map(([dept, items]) => {
                        const deptCheckedCount = items.filter((i) => i.checked).length;
                        const allDeptChecked = deptCheckedCount === items.length;

                        return (
                          <div key={dept}>
                            {/* Department Header - Sticky below store header */}
                            <div className={`px-4 py-2 border-b border-l-4 flex items-center justify-between sticky top-[48px] z-10 ${allDeptChecked ? "bg-emerald-50 border-l-emerald-400" : "bg-amber-50 border-l-amber-400"}`}>
                              <span className={`text-sm font-medium ${allDeptChecked ? "text-emerald-700" : "text-gray-700"}`}>
                                {dept}
                              </span>
                              <span className={`text-xs font-medium ${allDeptChecked ? "text-emerald-600" : "text-gray-500"}`}>
                                {deptCheckedCount}/{items.length}
                              </span>
                            </div>

                            {/* Items in Department */}
                            <div className="divide-y divide-gray-100">
                              {items.map((item) => (
                                <label
                                  key={item.id}
                                  className={`flex items-start px-4 py-3 cursor-pointer transition-colors ${
                                    updatingItems.has(item.id) ? "opacity-50" : "hover:bg-gray-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={() => handleToggleGroceryItem(item.id, item.checked)}
                                    disabled={updatingItems.has(item.id)}
                                    className="h-5 w-5 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                                  />
                                  <div className="ml-3 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`font-medium ${item.checked ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                        {item.ingredients?.name || "Unknown item"}
                                        {item.is_staple && (
                                          <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">
                                            Staple
                                          </span>
                                        )}
                                      </span>
                                      {item.quantity && (
                                        <span className={`text-sm font-medium ${item.checked ? "text-gray-400" : "text-gray-600"}`}>
                                          {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                                        </span>
                                      )}
                                    </div>
                                    {item.recipe_breakdown && item.recipe_breakdown.length > 0 && (
                                      <div className={`mt-1 text-xs space-y-0.5 ${item.checked ? "text-gray-400" : "text-gray-500"}`}>
                                        {item.recipe_breakdown.map((rb, idx) => (
                                          <div key={idx} className="flex justify-between">
                                            <span className="truncate mr-2">{rb.recipe_name}</span>
                                            <span className="whitespace-nowrap">
                                              {rb.quantity ?? "—"}{rb.unit ? ` ${rb.unit}` : ""}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {checkedCount === totalCount && totalCount > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-700">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">Shopping complete!</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : activeTab === "dinner" ? (
        /* Dinner Plans Tab - 3-column Table Layout */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4">
            {/* Sync to Calendar Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
              <p className="text-sm text-gray-500">
                Sync dinner plans to your Google Calendar
              </p>
              <button
                onClick={handleSyncToCalendar}
                disabled={isSyncingCalendar}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 active:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncingCalendar ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Sync to Calendar
                  </>
                )}
              </button>
            </div>

            {syncMessage && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  syncMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : syncMessage.type === "error"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
                }`}
              >
                {syncMessage.text}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {DAY_NAMES.map((dayName, index) => {
                  const meals = getMealsForDay(index + 1);
                  const today = isToday(index);

                  return (
                    <DroppableDay key={index} dayIndex={index}>
                      {/* Mobile Layout - Two lines */}
                      <div className={`md:hidden p-4 ${today ? "bg-emerald-50" : "hover:bg-gray-50"} transition-colors`}>
                        {/* Line 1: Date + Day name */}
                        <div className="flex items-center gap-3 mb-3">
                          <DateIcon dayIndex={index} weekOf={weeklyPlan.week_of} isHighlighted={today} />
                          <div className={`text-base font-semibold ${today ? "text-emerald-700" : "text-gray-900"}`}>
                            {dayName}
                            {today && <span className="ml-2 text-xs font-medium bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">Today</span>}
                          </div>
                        </div>
                        {/* Line 2: Meal details */}
                        {meals.length > 0 ? (
                          <div className="space-y-3 pl-2">
                            {meals.map((meal) => (
                              <div key={meal.id} className="flex flex-col gap-2">
                                {/* Recipe name row */}
                                <div className="flex items-center gap-2">
                                  {meal.recipes ? (
                                    <Link
                                      href={`/recipes/${meal.recipes.id}`}
                                      className="font-medium text-gray-900 hover:text-emerald-600 transition-colors"
                                    >
                                      {meal.recipes.name}
                                    </Link>
                                  ) : meal.custom_meal_name ? (
                                    <span className="font-medium text-gray-900">
                                      {meal.custom_meal_name}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic">No meal</span>
                                  )}
                                  {meal.is_leftover && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                      Leftovers
                                    </span>
                                  )}
                                </div>
                                {/* Controls row */}
                                <div className="flex items-center gap-2">
                                  <AssigneeDropdown
                                    currentAssignee={meal.assigned_user}
                                    members={householdMembers}
                                    onSelect={(userId) => handleMealAssigneeChange(meal.id, userId)}
                                    isUpdating={updatingMeals.has(meal.id)}
                                  />
                                  <select
                                    value={meal.day}
                                    onChange={(e) => handleMoveMeal(meal.id, parseInt(e.target.value))}
                                    disabled={updatingMeals.has(meal.id)}
                                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 min-h-[44px]"
                                  >
                                    {DAY_NAMES.map((name, idx) => (
                                      <option key={idx} value={idx + 1}>
                                        {name.slice(0, 3)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic pl-2">No dinner planned</span>
                        )}
                      </div>

                      {/* Desktop Layout - Single row */}
                      <div
                        className={`hidden md:flex items-center gap-4 p-4 ${today ? "bg-emerald-50" : "hover:bg-gray-50"} transition-colors`}
                      >
                        {/* Date Column - iCal Style */}
                        <div className="flex-shrink-0">
                          <DateIcon dayIndex={index} weekOf={weeklyPlan.week_of} isHighlighted={today} />
                        </div>

                        {/* Day Name & Meals Column */}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold mb-1 ${today ? "text-emerald-700" : "text-gray-700"}`}>
                            {dayName}
                            {today && <span className="ml-2 text-xs font-medium bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">Today</span>}
                          </div>
                          {meals.length > 0 ? (
                            <div className="space-y-1">
                              {meals.map((meal) => (
                                <DraggableMeal key={meal.id} meal={meal}>
                                  <div className="flex items-center gap-2">
                                    {/* Drag handle for desktop */}
                                    <div className="flex items-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0" title="Drag to move">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                                      </svg>
                                    </div>
                                    {meal.recipes ? (
                                      <Link
                                        href={`/recipes/${meal.recipes.id}`}
                                        className="font-medium text-gray-900 hover:text-emerald-600 transition-colors truncate"
                                      >
                                        {meal.recipes.name}
                                      </Link>
                                    ) : meal.custom_meal_name ? (
                                      <span className="font-medium text-gray-900 truncate">
                                        {meal.custom_meal_name}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 italic">No meal</span>
                                    )}
                                    {meal.is_leftover && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                                        Leftovers
                                      </span>
                                    )}
                                  </div>
                                </DraggableMeal>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">No dinner planned</span>
                          )}
                        </div>

                        {/* Assignee Column */}
                        <div className="flex-shrink-0">
                          {meals.length > 0 ? (
                            <div className="space-y-1">
                              {meals.map((meal) => (
                                <AssigneeDropdown
                                  key={meal.id}
                                  currentAssignee={meal.assigned_user}
                                  members={householdMembers}
                                  onSelect={(userId) => handleMealAssigneeChange(meal.id, userId)}
                                  isUpdating={updatingMeals.has(meal.id)}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </DroppableDay>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            {weeklyPlan.notes && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Notes
                </h2>
                <p className="text-gray-600 whitespace-pre-wrap">{weeklyPlan.notes}</p>
              </div>
            )}
          </div>

          {/* Drag Overlay - shows a preview of the dragged meal */}
          <DragOverlay>
            {activeDragMeal ? (
              <div className="bg-white shadow-lg rounded-lg px-3 py-2 border-2 border-emerald-400">
                <span className="font-medium text-gray-900">
                  {activeDragMeal.recipes?.name || activeDragMeal.custom_meal_name || "Meal"}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Events Tab - 3-column Table Layout matching Dinner Plans */
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {DAY_NAMES.map((dayName, index) => {
                const dayEvents = getEventsForDay(index);
                if (dayEvents.length === 0) return null;
                const today = isToday(index);

                return (
                  <div
                    key={index}
                    className={`flex items-start gap-4 p-4 ${today ? "bg-amber-50" : "hover:bg-gray-50"} transition-colors`}
                  >
                    {/* Date Column - iCal Style */}
                    <div className="flex-shrink-0">
                      <DateIcon dayIndex={index} weekOf={weeklyPlan.week_of} isHighlighted={today} />
                    </div>

                    {/* Day Name & Events Column */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold mb-1 ${today ? "text-amber-700" : "text-gray-700"}`}>
                        {dayName}
                        {today && <span className="ml-2 text-xs font-medium bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Today</span>}
                      </div>
                      <div className="space-y-2">
                        {dayEvents.map((event) => (
                          <div key={event.id}>
                            <div className="font-medium text-gray-900">{event.title}</div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-gray-500">
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
                        ))}
                      </div>
                    </div>

                    {/* Assignees Column */}
                    <div className="flex-shrink-0">
                      <div className="space-y-2">
                        {dayEvents.map((event) => (
                          <MultiAssigneeDropdown
                            key={event.id}
                            assignedUsers={event.assigned_users}
                            members={householdMembers}
                            onSelect={(userIds) => handleEventAssigneesChange(event.id, userIds)}
                            isUpdating={updatingEvents.has(event.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empty state if no events on any day */}
          {weeklyPlan.events?.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500">No events this week.</p>
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
        Created {new Date(weeklyPlan.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
      </div>
    </div>
  );
}
