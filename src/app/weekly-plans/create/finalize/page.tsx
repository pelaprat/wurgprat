"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMealPlanWizard } from "@/contexts/MealPlanWizardContext";

const DAY_NAMES = [
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

  // Count groceries by department
  const groceriesByDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    wizard.groceryItems
      .filter((item) => !item.checked)
      .forEach((item) => {
        const dept = item.department || "Other";
        counts[dept] = (counts[dept] || 0) + 1;
      });
    return counts;
  }, [wizard.groceryItems]);

  const totalGroceryItems = wizard.groceryItems.filter((i) => !i.checked).length;

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

  // Success state
  if (success && createdPlanId) {
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
        <p className="text-gray-600 mb-8">
          Your meal plan and grocery list have been saved.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href={`/weekly-plans/${createdPlanId}`}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            View Weekly Plan
          </Link>
          <Link
            href="/weekly-plans"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to All Plans
          </Link>
        </div>
      </div>
    );
  }

  const sortedMeals = [...wizard.proposedMeals].sort((a, b) => a.day - b.day);

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
          Step 4 of 4: Review your weekly plan and confirm
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
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="ml-2 text-sm text-emerald-600">Review</span>
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
            4
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
              {sortedMeals.length} dinners planned, {totalGroceryItems} grocery
              items
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meals summary */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold text-gray-900">Dinner Schedule</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {sortedMeals.map((meal) => (
              <div key={meal.day} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {DAY_NAMES[meal.day - 1]}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      {new Date(meal.date + "T00:00:00").toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )}
                    </span>
                  </div>
                  {meal.recipeTimeRating && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        meal.recipeTimeRating <= 2
                          ? "bg-green-100 text-green-800"
                          : meal.recipeTimeRating === 3
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {TIME_RATING_LABELS[meal.recipeTimeRating]}
                    </span>
                  )}
                </div>
                <p className="text-gray-700 mt-1">{meal.recipeName}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Groceries summary */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold text-gray-900">Grocery Summary</h3>
          </div>
          <div className="p-4">
            {totalGroceryItems === 0 ? (
              <p className="text-gray-500 text-sm">No grocery items</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(groceriesByDepartment)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dept, count]) => (
                    <div
                      key={dept}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">{dept}</span>
                      <span className="text-gray-500">
                        {count} item{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                <div className="pt-2 mt-2 border-t flex items-center justify-between font-medium">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{totalGroceryItems} items</span>
                </div>
              </div>
            )}
          </div>
        </div>
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
