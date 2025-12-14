"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Recipe {
  id: string;
  name: string;
  time_rating?: number;
  yields_leftovers?: boolean;
}

interface Meal {
  id: string;
  day: number;
  meal_type: string;
  custom_meal_name?: string;
  is_leftover: boolean;
  notes?: string;
  recipe?: Recipe;
}

interface GroceryItem {
  id: string;
  quantity?: number;
  unit?: string;
  checked: boolean;
  ingredient: {
    id: string;
    name: string;
    department?: string;
  };
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
  created_at: string;
}

const DAY_NAMES = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function WeeklyPlanDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const formatWeekOf = (dateStr: string) => {
    const date = new Date(dateStr);
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

  const getMealForDay = (day: number, mealType: string = "dinner") => {
    return weeklyPlan?.meals.find(
      (m) => m.day === day && m.meal_type === mealType
    );
  };

  const getDateForDay = (dayIndex: number) => {
    if (!weeklyPlan) return "";
    const weekOf = new Date(weeklyPlan.week_of);
    const date = new Date(weekOf);
    date.setDate(weekOf.getDate() + dayIndex);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

  const groceryList = weeklyPlan.grocery_list?.[0];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/weekly-plans"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to weekly plans
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Week of {formatWeekOf(weeklyPlan.week_of)}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Meal Schedule */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Dinner Schedule
            </h2>
            <div className="space-y-3">
              {DAY_NAMES.map((dayName, index) => {
                const meal = getMealForDay(index + 1);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-24">
                        <span className="font-medium text-gray-900">
                          {dayName}
                        </span>
                        <span className="text-xs text-gray-500 block">
                          {getDateForDay(index)}
                        </span>
                      </div>
                      <div>
                        {meal?.recipe ? (
                          <Link
                            href={`/recipes/${meal.recipe.id}`}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            {meal.recipe.name}
                          </Link>
                        ) : meal?.custom_meal_name ? (
                          <span className="text-gray-700">
                            {meal.custom_meal_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">No meal planned</span>
                        )}
                        {meal?.is_leftover && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">
                            Leftovers
                          </span>
                        )}
                      </div>
                    </div>
                    {meal?.recipe?.time_rating && (
                      <div className="text-sm text-gray-500">
                        {meal.recipe.time_rating <= 2 ? "Quick" : meal.recipe.time_rating >= 4 ? "Long" : "Medium"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {weeklyPlan.notes && (
            <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-600 whitespace-pre-wrap">
                {weeklyPlan.notes}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Grocery List Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Grocery List
            </h2>
            {groceryList && groceryList.grocery_items.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  {groceryList.grocery_items.filter((i) => i.checked).length} of{" "}
                  {groceryList.grocery_items.length} items checked
                </p>
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {groceryList.grocery_items.slice(0, 10).map((item) => (
                    <li
                      key={item.id}
                      className={`text-sm ${
                        item.checked ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {item.ingredient.name}
                    </li>
                  ))}
                  {groceryList.grocery_items.length > 10 && (
                    <li className="text-sm text-gray-500">
                      + {groceryList.grocery_items.length - 10} more items
                    </li>
                  )}
                </ul>
                <Link
                  href="/groceries"
                  className="text-sm text-emerald-600 hover:text-emerald-700 mt-3 inline-block"
                >
                  View full list &rarr;
                </Link>
              </>
            ) : (
              <p className="text-gray-500 text-sm">No grocery list yet.</p>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Actions</h2>
            <div className="space-y-2">
              <Link
                href="/meals"
                className="w-full block text-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Edit Meals
              </Link>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete Plan
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-400 px-2">
            <p>Created: {new Date(weeklyPlan.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
