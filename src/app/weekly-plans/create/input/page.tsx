"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMealPlanWizard } from "@/contexts/MealPlanWizardContext";
import { useEvents, Event } from "@/contexts/EventsContext";
import { formatDateLocal, getWeekDates, getSaturdayOptions, getNextSaturday } from "@/utils/dates";
import { DAY_NAMES } from "@/constants/calendar";
import { TIME_RATING_LABELS } from "@/constants/recipes";

interface Recipe {
  id: string;
  name: string;
  description?: string;
  source?: string;
  time_rating?: number;
  yields_leftovers?: boolean;
  category?: string;
  cuisine?: string;
  status: string;
  average_rating?: number;
}

interface ExistingPlan {
  id: string;
  week_of: string;
}

// Filter events for a specific week
function getEventsForWeek(events: Event[], weekOf: string): Event[] {
  const weekDates = getWeekDates(weekOf);
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

export default function InputPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { events: allEvents } = useEvents();
  const wizard = useMealPlanWizard();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [existingPlans, setExistingPlans] = useState<ExistingPlan[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"recipes" | "schedule">("recipes");

  // Fetch recipes and existing plans on mount
  useEffect(() => {
    console.log("[InputPage] useEffect triggered, session:", !!session, "email:", session?.user?.email);
    if (session) {
      fetchRecipes();
      fetchExistingPlans();
    }
  }, [session]);

  const fetchRecipes = async () => {
    console.log("[InputPage] Fetching recipes...");
    try {
      // Fetch all household recipes (not filtered by status)
      const response = await fetch("/api/recipes");
      console.log("[InputPage] Recipes response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("[InputPage] Recipes loaded:", data.recipes?.length || 0, "recipes");
        setRecipes(data.recipes || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("[InputPage] Failed to fetch recipes:", response.status, errorData);
        setError(`Failed to load recipes: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("[InputPage] Failed to fetch recipes:", error);
      setError("Failed to load recipes. Please check your connection.");
    } finally {
      setIsLoadingRecipes(false);
    }
  };

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

  // Saturday options for dropdown
  const saturdayOptions = useMemo(() => getSaturdayOptions(), []);

  // Get events for the selected week
  const weekEvents = useMemo(() => {
    return getEventsForWeek(allEvents, wizard.weekOf);
  }, [allEvents, wizard.weekOf]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const weekDates = getWeekDates(wizard.weekOf);
    const byDay: Record<string, Event[]> = {};

    weekDates.forEach((date) => {
      const dateStr = formatDateLocal(date);
      byDay[dateStr] = [];
    });

    weekEvents.forEach((event) => {
      const eventDate = formatDateLocal(new Date(event.start_time));
      if (byDay[eventDate]) {
        byDay[eventDate].push(event);
      }
    });

    return byDay;
  }, [weekEvents, wizard.weekOf]);

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesSearch =
        !searchFilter ||
        recipe.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        recipe.cuisine?.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesCategory =
        !categoryFilter || recipe.category === categoryFilter;
      const matchesStatus =
        !statusFilter || recipe.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [recipes, searchFilter, categoryFilter, statusFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(recipes.map((r) => r.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [recipes]);

  // Check if selected week already has a plan
  const selectedWeekHasPlan = existingPlans.some(p => p.week_of === wizard.weekOf);

  // Handle generate
  const handleGenerate = async () => {
    if (selectedWeekHasPlan) {
      setError("A plan already exists for this week. Please select a different week.");
      return;
    }

    setError(null);
    wizard.setIsGenerating(true);

    try {
      // Store week events in wizard
      wizard.setWeekEvents(weekEvents);

      const response = await fetch("/api/weekly-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekOf: wizard.weekOf,
          userDescription: wizard.userDescription,
          selectedRecipeIds: wizard.selectedRecipeIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate meal plan");
      }

      const data = await response.json();
      wizard.setProposedMeals(data.proposedMeals);
      wizard.setAiExplanation(data.aiExplanation);

      // Navigate to review page
      router.push("/weekly-plans/create/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      wizard.setIsGenerating(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to create a meal plan.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
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
        <h1 className="text-2xl font-bold text-gray-900">
          Create Weekly Meal Plan
        </h1>
        <p className="text-gray-600 mt-1">
          Step 1 of 4: Select a week and describe your preferences
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-medium">
            1
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Start</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            2
          </div>
          <span className="ml-2 text-sm text-gray-500">Meals</span>
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

      {/* Describe Your Preferences - now at the top */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          What are you in the mood for this week?
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Tell the AI your preferences. Consider your schedule below when describing what you&apos;d like to eat.
        </p>
        <textarea
          value={wizard.userDescription}
          onChange={(e) => wizard.setUserDescription(e.target.value)}
          placeholder="e.g., We have a busy Wednesday evening so need something quick. Looking for mostly healthy options but maybe one comfort food night. Kids are visiting on Saturday so need a crowd-pleaser..."
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Mobile tabs - shown only on mobile */}
      <div className="lg:hidden mb-4">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("recipes")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
              activeTab === "recipes"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Select Recipes {wizard.selectedRecipeIds.length > 0 && `(${wizard.selectedRecipeIds.length})`}
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
              activeTab === "schedule"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            View Schedule
          </button>
        </div>
      </div>

      {/* Main content - two columns on desktop, tabbed on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Week Schedule - hidden on mobile unless schedule tab is active */}
        <div className={`bg-white rounded-xl shadow-sm p-6 ${activeTab !== "schedule" ? "hidden lg:block" : ""}`}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            This Week&apos;s Schedule
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Your calendar events for the week. The AI will suggest quick meals on busy days.
          </p>

          <div className="space-y-3">
            {getWeekDates(wizard.weekOf).map((date, index) => {
              const dateStr = formatDateLocal(date);
              const dayEvents = eventsByDay[dateStr] || [];
              const isBusy = dayEvents.length > 0;

              return (
                <div
                  key={dateStr}
                  className="rounded-xl border-2 overflow-hidden border-gray-200 bg-gray-50"
                >
                  {/* Day header */}
                  <div className="px-4 py-2 bg-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {DAY_NAMES[index]}
                        </span>
                        <span className="text-sm text-gray-600 ml-2">
                          {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      {isBusy && (
                        <span className="text-xs px-2 py-1 bg-amber-200 text-amber-800 rounded-full font-medium">
                          {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Events content */}
                  <div className="px-4 py-3">
                    {dayEvents.length > 0 ? (
                      <div className="space-y-2">
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                          >
                            <span className="text-amber-600 mt-0.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </span>
                            <div>
                              <span className="font-medium text-gray-900">{event.title}</span>
                              <span className="text-gray-500 ml-1">
                                {event.all_day
                                  ? "(All day)"
                                  : `at ${new Date(event.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">
                        No events - flexible schedule
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Recipe selection - hidden on mobile unless recipes tab is active */}
        <div className={`bg-white rounded-xl shadow-sm p-6 ${activeTab !== "recipes" ? "hidden lg:block" : ""}`}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Select Recipes
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Choose specific recipes to include, or let the AI pick from your collection.
            {recipes.length > 0 && (
              <span className="text-gray-400 ml-1">
                ({filteredRecipes.length} of {recipes.length} shown)
              </span>
            )}
          </p>

          {/* Filters */}
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search recipes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              >
                <option value="">All recipes</option>
                <option value="made">Made before</option>
                <option value="wishlist">Wishlist</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected count */}
          {wizard.selectedRecipeIds.length > 0 && (
            <div className="flex items-center justify-between mb-3 p-2 bg-emerald-50 rounded-lg">
              <span className="text-sm text-emerald-700">
                {wizard.selectedRecipeIds.length} recipe
                {wizard.selectedRecipeIds.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={() => wizard.setSelectedRecipeIds([])}
                className="text-xs text-emerald-600 hover:text-emerald-700"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Recipe list */}
          <div className="max-h-[500px] overflow-y-auto space-y-2">
            {isLoadingRecipes ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No recipes found in your household.</p>
                <p className="text-gray-400 text-sm mb-4">Add recipes to start planning meals.</p>
                <Link href="/recipes/new" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                  + Add your first recipe
                </Link>
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No recipes match your filters</p>
                <button
                  onClick={() => {
                    setSearchFilter("");
                    setCategoryFilter("");
                    setStatusFilter("");
                  }}
                  className="text-emerald-600 hover:text-emerald-700 text-sm"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              filteredRecipes.map((recipe) => {
                const isSelected = wizard.selectedRecipeIds.includes(recipe.id);
                return (
                  <div
                    key={recipe.id}
                    onClick={() => wizard.toggleRecipeSelection(recipe.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-1 h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">
                          {recipe.name}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {recipe.status === "wishlist" && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">
                              Wishlist
                            </span>
                          )}
                          {recipe.time_rating && (
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                recipe.time_rating <= 2
                                  ? "bg-green-100 text-green-800"
                                  : recipe.time_rating === 3
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {TIME_RATING_LABELS[recipe.time_rating]}
                            </span>
                          )}
                          {recipe.yields_leftovers && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                              Leftovers
                            </span>
                          )}
                          {recipe.category && (
                            <span className="text-xs text-gray-500 capitalize">
                              {recipe.category}
                            </span>
                          )}
                          {recipe.cuisine && (
                            <span className="text-xs text-gray-400">
                              {recipe.cuisine}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
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

      {/* Action buttons - sticky on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-safe md:relative md:border-0 md:p-0 md:mt-6 z-20">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <Link
            href="/weekly-plans"
            className="px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors min-h-[44px] flex items-center"
          >
            Cancel
          </Link>
          <button
            onClick={handleGenerate}
            disabled={wizard.isGenerating || selectedWeekHasPlan || recipes.length === 0}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
          >
            {wizard.isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </>
            ) : (
              <>
                Generate Meal Plan
                <span className="text-emerald-200">&rarr;</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Padding for fixed bottom bar on mobile */}
      <div className="h-24 md:hidden"></div>
    </div>
  );
}
