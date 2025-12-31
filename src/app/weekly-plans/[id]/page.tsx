"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DAY_NAMES } from "@/constants/calendar";
import { WeeklyPlanDetailSkeleton } from "@/components/Skeleton";

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
  is_ai_suggested?: boolean;
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
  ingredients: Ingredient | null;
  recipe_breakdown?: RecipeBreakdown[];
}

interface GroceryList {
  id: string;
  notes?: string;
  grocery_items: GroceryItem[];
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

export default function WeeklyPlanDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tabParam = searchParams.get("tab");
  const initialTab: TabType = tabParam === "dinner" ? "dinner" : tabParam === "events" ? "events" : "grocery";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [updatingMeals, setUpdatingMeals] = useState<Set<string>>(new Set());
  const [updatingEvents, setUpdatingEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      if (!params.id) return;

      try {
        const [planResponse, membersResponse] = await Promise.all([
          fetch(`/api/weekly-plans/${params.id}`),
          fetch("/api/household/members"),
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

  const groceryItemsByStore = useMemo(() => {
    if (!groceryList?.grocery_items) return new Map<string, GroceryItem[]>();

    const grouped = new Map<string, GroceryItem[]>();
    groceryList.grocery_items.forEach((item) => {
      const store = item.ingredients?.store_name || "No Store Assigned";
      if (!grouped.has(store)) {
        grouped.set(store, []);
      }
      grouped.get(store)!.push(item);
    });

    grouped.forEach((items) => {
      items.sort((a, b) => {
        const nameA = a.ingredients?.name || "";
        const nameB = b.ingredients?.name || "";
        return nameA.localeCompare(nameB);
      });
    });

    const sortedEntries = Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === "No Store Assigned") return 1;
      if (b[0] === "No Store Assigned") return -1;
      return a[0].localeCompare(b[0]);
    });

    return new Map(sortedEntries);
  }, [groceryList?.grocery_items]);

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
              <p className="text-gray-500">No grocery list for this week.</p>
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
              </div>

              <div className="space-y-4">
                {Array.from(groceryItemsByStore.entries()).map(([store, items]) => {
                  const storeCheckedCount = items.filter((i) => i.checked).length;
                  const allChecked = storeCheckedCount === items.length;

                  return (
                    <div key={store} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className={`px-4 py-3 border-b flex items-center justify-between ${allChecked ? "bg-emerald-50" : "bg-gray-50"}`}>
                        <div className="flex items-center gap-2">
                          <svg className={`w-5 h-5 ${allChecked ? "text-emerald-600" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <h3 className={`font-semibold ${allChecked ? "text-emerald-700" : "text-gray-900"}`}>
                            {store}
                          </h3>
                        </div>
                        <span className={`text-sm font-medium ${allChecked ? "text-emerald-600" : "text-gray-500"}`}>
                          {storeCheckedCount}/{items.length}
                        </span>
                      </div>
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
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {DAY_NAMES.map((dayName, index) => {
                const meals = getMealsForDay(index + 1);
                const today = isToday(index);

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-4 p-4 ${today ? "bg-emerald-50" : "hover:bg-gray-50"} transition-colors`}
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
                            <div key={meal.id} className="flex items-center gap-2">
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
