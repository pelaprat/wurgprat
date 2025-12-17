"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Recipe {
  id: string;
  name: string;
  time_rating?: number;
  yields_leftovers?: boolean;
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
  sort_order?: number;
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

const DAY_NAMES = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type TabType = "dinner" | "grocery" | "events";

export default function WeeklyPlanDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tabParam = searchParams.get("tab");
  const initialTab: TabType = tabParam === "dinner" ? "dinner" : tabParam === "events" ? "events" : "grocery";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchWeeklyPlan = async () => {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/weekly-plans/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setWeeklyPlan(data.weeklyPlan);
        } else {
          setError("Weekly plan not found");
        }
      } catch {
        setError("Failed to load weekly plan");
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchWeeklyPlan();
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

  const handleToggleGroceryItem = async (itemId: string, currentChecked: boolean) => {
    if (updatingItems.has(itemId)) return;

    setUpdatingItems((prev) => new Set(prev).add(itemId));

    // Optimistically update the UI
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
        // Revert on error
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
      // Revert on error
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
    return weeklyPlan?.meals
      .filter((m) => m.day === day && m.meal_type === mealType)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) || [];
  };

  const getDateForDay = (dayIndex: number) => {
    if (!weeklyPlan) return "";
    const weekOf = new Date(weeklyPlan.week_of + "T00:00:00");
    const date = new Date(weekOf);
    date.setDate(weekOf.getDate() + dayIndex);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const groceryList = weeklyPlan?.grocery_list?.[0];

  // Group grocery items by store
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

    // Sort items within each store by name
    grouped.forEach((items) => {
      items.sort((a, b) => {
        const nameA = a.ingredients?.name || "";
        const nameB = b.ingredients?.name || "";
        return nameA.localeCompare(nameB);
      });
    });

    // Sort stores alphabetically, but put "No Store Assigned" at the end
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

  // Format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get events for a specific day
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
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error || !weeklyPlan) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">{error || "Weekly plan not found"}</p>
          <Link
            href="/weekly-plans"
            className="text-emerald-600 hover:text-emerald-700 mt-4 inline-block"
          >
            Back to weekly plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <Link
          href="/weekly-plans"
          className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block"
        >
          &larr; Back to weekly plans
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            Week of {formatWeekOf(weeklyPlan.week_of)}
          </h1>
          <button
            onClick={handleDelete}
            className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab("grocery")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "grocery"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Grocery List
            {totalCount > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
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
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "dinner"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Dinner Plan
          </button>
          {eventsCount > 0 && (
            <button
              onClick={() => setActiveTab("events")}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === "events"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Events
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                {eventsCount}
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "grocery" ? (
        <div className="space-y-3">
          {/* Grocery List */}
          {!groceryList || groceryList.grocery_items.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500">No grocery list for this week.</p>
            </div>
          ) : (
            <>
              {/* Compact Progress bar */}
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {checkedCount}/{totalCount}
                </span>
              </div>

              {/* Items grouped by store */}
              <div className="space-y-3">
                {Array.from(groceryItemsByStore.entries()).map(([store, items]) => {
                  const storeCheckedCount = items.filter(i => i.checked).length;
                  const allChecked = storeCheckedCount === items.length;

                  return (
                    <div key={store} className="bg-white rounded-lg shadow-sm overflow-hidden">
                      <div className={`px-3 py-2 border-b flex items-center justify-between ${allChecked ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                        <h3 className={`font-medium text-sm ${allChecked ? 'text-emerald-700' : 'text-gray-900'}`}>
                          {store}
                        </h3>
                        <span className={`text-xs ${allChecked ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {storeCheckedCount}/{items.length}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className={`px-3 py-2 ${updatingItems.has(item.id) ? "opacity-50" : ""}`}
                          >
                            <label className="flex items-start cursor-pointer hover:bg-gray-50 transition-colors -mx-3 px-3 py-1">
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={() => handleToggleGroceryItem(item.id, item.checked)}
                                disabled={updatingItems.has(item.id)}
                                className="h-4 w-4 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                              />
                              <div className="ml-2 flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-sm font-medium ${
                                      item.checked ? "text-gray-400 line-through" : "text-gray-900"
                                    }`}
                                  >
                                    {item.ingredients?.name || "Unknown item"}
                                  </span>
                                  {item.quantity && (
                                    <span className={`text-xs ml-2 ${item.checked ? "text-gray-400" : "text-gray-500"}`}>
                                      {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                                    </span>
                                  )}
                                </div>
                                {item.recipe_breakdown && item.recipe_breakdown.length > 0 && (
                                  <div className={`mt-1 text-xs ${item.checked ? "text-gray-400" : "text-gray-500"}`}>
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
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Completion message */}
              {checkedCount === totalCount && totalCount > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-emerald-800 text-sm font-medium">
                    All done!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      ) : activeTab === "dinner" ? (
        <div className="space-y-4">
          {/* Dinner Schedule */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Dinner Schedule
            </h2>
            <div className="space-y-2">
              {DAY_NAMES.map((dayName, index) => {
                const meals = getMealsForDay(index + 1);
                return (
                  <div
                    key={index}
                    className="flex items-start py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="w-20 flex-shrink-0">
                      <span className="font-medium text-sm text-gray-900">
                        {dayName}
                      </span>
                      <span className="text-xs text-gray-500 block">
                        {getDateForDay(index)}
                      </span>
                    </div>
                    <div className="flex-1 space-y-2">
                      {meals.length > 0 ? (
                        meals.map((meal) => (
                          <div key={meal.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {meal.recipes ? (
                                <Link
                                  href={`/recipes/${meal.recipes.id}`}
                                  className="text-sm text-emerald-600 hover:text-emerald-700 truncate"
                                >
                                  {meal.recipes.name}
                                </Link>
                              ) : meal.custom_meal_name ? (
                                <span className="text-sm text-gray-700 truncate">
                                  {meal.custom_meal_name}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400 italic">No meal</span>
                              )}
                              {meal.is_leftover && (
                                <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded flex-shrink-0">
                                  Leftovers
                                </span>
                              )}
                            </div>
                            {meal.assigned_user && (
                              <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded flex-shrink-0">
                                {meal.assigned_user.name || meal.assigned_user.email}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400 italic">No meal</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {weeklyPlan.notes && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {weeklyPlan.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-400">
            <p>Created: {new Date(weeklyPlan.created_at).toLocaleString()}</p>
          </div>
        </div>
      ) : (
        /* Events Tab */
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Events This Week
            </h2>
            <div className="space-y-2">
              {DAY_NAMES.map((dayName, index) => {
                const dayEvents = getEventsForDay(index);
                if (dayEvents.length === 0) return null;

                return (
                  <div
                    key={index}
                    className="py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm text-gray-900">
                        {dayName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getDateForDay(index)}
                      </span>
                    </div>
                    <div className="space-y-2 pl-2">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
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
                                <span className="font-medium text-sm text-gray-900">
                                  {event.title}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {event.all_day
                                  ? "All day"
                                  : new Date(event.start_time).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                {event.location && (
                                  <span className="ml-2">
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
                                  </span>
                                )}
                              </p>
                            </div>
                            {event.assigned_users.length > 0 && (
                              <div className="flex flex-wrap gap-1 flex-shrink-0">
                                {event.assigned_users.map((user) => (
                                  <span
                                    key={user.id}
                                    className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded"
                                  >
                                    {user.name || user.email}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
