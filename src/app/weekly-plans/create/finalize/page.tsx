"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMealPlanWizard, ProposedMeal } from "@/contexts/MealPlanWizardContext";

const DAY_NAMES = [
  "Sat",
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
];

const DAY_NAMES_FULL = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const TIME_RATING_LABELS: Record<number, string> = {
  1: "Very Quick",
  2: "Quick",
  3: "Medium",
  4: "Long",
  5: "Very Long",
};

const TIME_RATING_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-green-100 text-green-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-red-100 text-red-800",
  5: "bg-red-100 text-red-800",
};

export default function FinalizePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const wizard = useMealPlanWizard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);

  // Redirect if no meals proposed yet
  useEffect(() => {
    if (!wizard.proposedMeals || wizard.proposedMeals.length === 0) {
      router.replace("/weekly-plans/create/input");
    }
  }, [wizard.proposedMeals, router]);

  // Get meals organized by day
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
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Sorted grocery items (unchecked only)
  const sortedGroceryItems = useMemo(() => {
    return wizard.groceryItems
      .filter((i) => !i.checked)
      .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
  }, [wizard.groceryItems]);

  const totalGroceryItems = sortedGroceryItems.length;

  // Handle final submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    wizard.setIsFinalizing(true);

    try {
      const response = await fetch("/api/weekly-plans/create-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekOf: wizard.weekOf,
          meals: wizard.proposedMeals,
          groceryItems: wizard.groceryItems.filter((i) => !i.checked),
          eventAssignments: wizard.eventAssignments,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create weekly plan");
      }

      const data = await response.json();
      setCreatedPlanId(data.weeklyPlanId);
      setSuccess(true);

      // Reset wizard after successful creation
      wizard.resetWizard();

      // Redirect to home page with notification
      router.push("/?notification=weekly-plan-created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
      wizard.setIsFinalizing(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to continue.</p>
      </div>
    );
  }

  // Success state - shown briefly before redirect or as fallback
  if (success) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Weekly Plan Created!
        </h1>
        <p className="text-gray-600 mb-4">Redirecting...</p>
        <Link
          href="/"
          className="text-emerald-600 hover:text-emerald-700"
        >
          Go to Home
        </Link>
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
          <span className="text-gray-900">Finalize</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Review &amp; Confirm</h1>
        <p className="text-gray-600 mt-1">
          Step 5 of 5: Review your weekly plan and confirm
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
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="ml-2 text-sm text-emerald-600">Events</span>
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
          <span className="ml-2 text-sm text-emerald-600">Groceries</span>
        </div>
        <div className="flex-1 h-0.5 bg-emerald-600 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-medium">
            5
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Finalize</span>
        </div>
      </div>

      {/* Week overview */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-emerald-600"
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
            <h2 className="font-semibold text-emerald-900">
              Week of{" "}
              {new Date(wizard.weekOf + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
            <p className="text-sm text-emerald-700">
              {wizard.proposedMeals.length} dinners planned, {totalGroceryItems} grocery
              items
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Calendar View for Dinners */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">Dinner Schedule</h3>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[700px]">
            {weekDates.map((date, index) => {
              const day = index + 1;
              const meals = getMealsForDay(day);
              const dateObj = new Date(date + "T00:00:00");

              return (
                <div
                  key={day}
                  className={`border-r last:border-r-0 ${index === 0 ? "" : ""}`}
                >
                  {/* Day header */}
                  <div className="px-2 py-2 bg-gray-50 border-b text-center">
                    <div className="font-medium text-gray-900 text-sm">
                      {DAY_NAMES[index]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {dateObj.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>

                  {/* Meals for this day */}
                  <div className="p-2 min-h-[120px] space-y-2">
                    {meals.length > 0 ? (
                      meals.map((meal) => (
                        <div
                          key={meal.mealId}
                          className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg"
                        >
                          <div className="text-sm font-medium text-gray-900 line-clamp-2">
                            {meal.recipeName}
                          </div>
                          {meal.recipeTimeRating && (
                            <div className="mt-1">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${TIME_RATING_COLORS[meal.recipeTimeRating]}`}
                              >
                                {TIME_RATING_LABELS[meal.recipeTimeRating]}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-400 text-center py-4">
                        No dinner
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grocery List Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Grocery List</h3>
          <span className="text-sm text-gray-500">{totalGroceryItems} items</span>
        </div>
        {totalGroceryItems === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No grocery items
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ingredient
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Recipes
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Store
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedGroceryItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span className="font-medium text-gray-900 text-sm">
                        {item.ingredientName}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-sm text-gray-700">
                        {item.totalQuantity}
                        {item.unit ? ` ${item.unit}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-sm text-gray-600">
                        {item.recipeBreakdown.length > 0
                          ? item.recipeBreakdown.map((b) => b.recipeName).join(", ")
                          : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-sm text-gray-600">
                        {item.department || "Other"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-sm text-gray-600">
                        {item.storeName || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex justify-between items-center">
        <Link
          href="/weekly-plans/create/groceries"
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
        >
          <span>&lt;-</span>
          Back to Groceries
        </Link>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-3 bg-emerald-600 text-white text-lg rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Creating...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Looks Good!
            </>
          )}
        </button>
      </div>
    </div>
  );
}
