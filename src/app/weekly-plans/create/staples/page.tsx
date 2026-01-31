"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMealPlanWizard, StapleItemDraft } from "@/contexts/MealPlanWizardContext";
import { DEPARTMENT_ORDER } from "@/constants/grocery";
import WizardProgress from "@/components/WizardProgress";

const WIZARD_STEPS = [
  { id: "review", label: "Meals", href: "/weekly-plans/create/review" },
  { id: "staples", label: "Staples", href: "/weekly-plans/create/staples" },
  { id: "events", label: "Events", href: "/weekly-plans/create/events" },
  { id: "groceries", label: "Groceries", href: "/weekly-plans/create/groceries" },
];

interface Ingredient {
  id: string;
  name: string;
  department: string | null;
  store_id: string | null;
  store: { id: string; name: string } | null;
}

interface StapleItemCardProps {
  item: StapleItemDraft;
  onUpdate: (id: string, updates: Partial<StapleItemDraft>) => void;
  onRemove: (id: string) => void;
}

function StapleItemCard({ item, onUpdate, onRemove }: StapleItemCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900">{item.ingredientName}</div>
        <div className="text-sm text-gray-500">{item.department}</div>
      </div>
      <input
        type="text"
        value={item.quantity}
        onChange={(e) => onUpdate(item.id, { quantity: e.target.value })}
        className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        placeholder="Qty"
      />
      <input
        type="text"
        value={item.unit}
        onChange={(e) => onUpdate(item.id, { unit: e.target.value })}
        className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        placeholder="Unit"
      />
      <button
        onClick={() => onRemove(item.id)}
        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        title="Remove staple"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function StaplesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const wizard = useMealPlanWizard();

  const [isLoading, setIsLoading] = useState(false);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [previousWeekOf, setPreviousWeekOf] = useState<string | null>(null);
  const [hasLoadedPrevious, setHasLoadedPrevious] = useState(false);

  // Redirect if no meals proposed yet
  useEffect(() => {
    if (!wizard.proposedMeals || wizard.proposedMeals.length === 0) {
      router.replace("/weekly-plans/create/review");
    }
  }, [wizard.proposedMeals, router]);

  // Load previous week's staples on mount (only once)
  useEffect(() => {
    const loadPreviousStaples = async () => {
      if (hasLoadedPrevious || wizard.stapleItems.length > 0) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/weekly-plans/previous-staples?weekOf=${wizard.weekOf}`);
        if (response.ok) {
          const data = await response.json();
          if (data.staples && data.staples.length > 0) {
            wizard.setStapleItems(data.staples);
          }
          setPreviousWeekOf(data.previousWeekOf);
        }
      } catch (err) {
        console.error("Failed to load previous staples:", err);
      } finally {
        setIsLoading(false);
        setHasLoadedPrevious(true);
      }
    };

    if (session && wizard.weekOf) {
      loadPreviousStaples();
    }
  }, [session, wizard.weekOf, hasLoadedPrevious, wizard.stapleItems.length]);

  // Fetch all ingredients for the add ingredient search
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const response = await fetch("/api/ingredients");
        if (response.ok) {
          const data = await response.json();
          setAllIngredients(data.ingredients || []);
        }
      } catch (err) {
        console.error("Failed to fetch ingredients:", err);
      }
    };

    if (session) {
      fetchIngredients();
    }
  }, [session]);

  // Filter ingredients based on search, excluding already-added ones
  const filteredIngredients = useMemo(() => {
    if (!ingredientSearch.trim()) return [];

    const existingIds = new Set(wizard.stapleItems.map((s) => s.ingredientId));

    return allIngredients
      .filter((ing) =>
        ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()) &&
        !existingIds.has(ing.id)
      )
      .slice(0, 10);
  }, [ingredientSearch, allIngredients, wizard.stapleItems]);

  // Check if search term matches an existing ingredient
  const exactMatch = useMemo(() => {
    return allIngredients.find(
      (ing) => ing.name.toLowerCase() === ingredientSearch.toLowerCase().trim()
    );
  }, [ingredientSearch, allIngredients]);

  // Handle adding an ingredient as a staple
  const handleAddIngredient = (ingredient: Ingredient) => {
    wizard.addStapleItem({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      department: ingredient.department || "Other",
      storeId: ingredient.store_id || undefined,
      storeName: ingredient.store?.name || undefined,
      quantity: "1",
      unit: "",
    });
    setIngredientSearch("");
    setShowAddIngredient(false);
  };

  // Handle creating a new ingredient and adding it as a staple
  const handleCreateIngredient = async () => {
    if (!ingredientSearch.trim()) return;

    try {
      const response = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ingredientSearch.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        const newIngredient = data.ingredient;

        // Add to local ingredients list
        setAllIngredients((prev) => [...prev, newIngredient]);

        // Add as staple
        wizard.addStapleItem({
          ingredientId: newIngredient.id,
          ingredientName: newIngredient.name,
          department: newIngredient.department || "Other",
          storeId: newIngredient.store_id || undefined,
          storeName: newIngredient.store?.name || undefined,
          quantity: "1",
          unit: "",
        });

        setIngredientSearch("");
        setShowAddIngredient(false);
      }
    } catch (err) {
      console.error("Failed to create ingredient:", err);
    }
  };

  // Handle continue - go to events if there are events, otherwise groceries
  const handleContinue = () => {
    if (wizard.weekEvents.length > 0) {
      router.push("/weekly-plans/create/events");
    } else {
      router.push("/weekly-plans/create/groceries");
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to continue.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <p className="text-gray-600">Loading staples from previous week...</p>
        </div>
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
            href="/weekly-plans/create/review"
            className="hover:text-emerald-600 transition-colors"
          >
            Create
          </Link>
          <span>/</span>
          <span className="text-gray-900">Staples</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Weekly Staples</h1>
        <WizardProgress steps={WIZARD_STEPS} currentStep="staples" />
        <p className="text-gray-600">
          Add recurring items like milk, eggs, and snacks
        </p>
      </div>

      {/* Info banner */}
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-purple-900">
              Recurring Staples
            </h3>
            <p className="text-sm text-purple-700 mt-1">
              {previousWeekOf
                ? `These items are from your week of ${new Date(previousWeekOf + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Edit quantities or add new items as needed.`
                : "Add items you buy every week like milk, bread, eggs, or snacks. They'll be saved for future weeks."}
            </p>
          </div>
        </div>
      </div>

      {/* Staples list */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">
            Your Staples ({wizard.stapleItems.length})
          </h3>
          <button
            onClick={() => setShowAddIngredient(!showAddIngredient)}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + Add Item
          </button>
        </div>

        {/* Add ingredient section */}
        {showAddIngredient && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <input
              type="text"
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              placeholder="Search ingredients..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
            />

            {ingredientSearch.trim() && (
              <div className="mt-2 max-h-48 overflow-y-auto">
                {filteredIngredients.length > 0 ? (
                  <div className="space-y-1">
                    {filteredIngredients.map((ingredient) => (
                      <button
                        key={ingredient.id}
                        onClick={() => handleAddIngredient(ingredient)}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-900">{ingredient.name}</span>
                        <span className="text-sm text-gray-500">{ingredient.department || "Other"}</span>
                      </button>
                    ))}
                  </div>
                ) : !exactMatch ? (
                  <button
                    onClick={handleCreateIngredient}
                    className="w-full text-left px-3 py-2 bg-emerald-50 text-emerald-800 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <span className="font-medium">Create &quot;{ingredientSearch.trim()}&quot;</span>
                    <span className="text-sm ml-2">(new ingredient)</span>
                  </button>
                ) : null}
              </div>
            )}

            <button
              onClick={() => {
                setShowAddIngredient(false);
                setIngredientSearch("");
              }}
              className="mt-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {/* List of staple items */}
        {wizard.stapleItems.length > 0 ? (
          <div className="space-y-2">
            {wizard.stapleItems.map((item) => (
              <StapleItemCard
                key={item.id}
                item={item}
                onUpdate={wizard.updateStapleItem}
                onRemove={wizard.removeStapleItem}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <p>No staples added yet</p>
            <p className="text-sm mt-1">Click &quot;Add Item&quot; to add recurring grocery items</p>
          </div>
        )}
      </div>

      {/* Action buttons - sticky on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-6 md:relative md:border-0 md:p-0 md:mt-8 z-20">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <Link
            href="/weekly-plans/create/review"
            className="px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            <span>&larr;</span>
            Back
          </Link>
          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            Continue
            <span>&rarr;</span>
          </button>
        </div>
      </div>

      {/* Padding for fixed bottom bar on mobile */}
      <div className="h-24 md:hidden"></div>
    </div>
  );
}
