"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RecipeDetailSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

interface Ingredient {
  id: string;
  name: string;
  department?: string;
  store?: {
    id: string;
    name: string;
  };
}

interface RecipeIngredient {
  id: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  sort_order: number;
  ingredient: Ingredient;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  source?: string;
  source_url?: string;
  servings?: number;
  cost_rating?: number;
  time_rating?: number;
  yields_leftovers?: boolean;
  category?: string;
  cuisine?: string;
  instructions?: string;
  notes?: string;
  status: string;
  tags?: string[];
  last_made?: string;
  created_at: string;
  updated_at: string;
  recipe_ingredients: RecipeIngredient[];
}

interface RatingUser {
  id: string;
  name?: string;
  email: string;
}

interface RecipeRating {
  id: string;
  rating: number;
  created_at: string;
  updated_at: string;
  user: RatingUser;
}

export default function RecipeDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQueued, setIsQueued] = useState(false);
  const [queueItemId, setQueueItemId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDebug, setImportDebug] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedIngredients, setEditedIngredients] = useState<RecipeIngredient[]>([]);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [isCreatingIngredient, setIsCreatingIngredient] = useState(false);

  // Rating state
  const [ratings, setRatings] = useState<RecipeRating[]>([]);
  const [currentUserRating, setCurrentUserRating] = useState<RecipeRating | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // Cost/Time rating state
  const [hoverCostRating, setHoverCostRating] = useState<number | null>(null);
  const [hoverTimeRating, setHoverTimeRating] = useState<number | null>(null);
  const [isSubmittingMetric, setIsSubmittingMetric] = useState(false);

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/recipes/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setRecipe(data.recipe);
        } else {
          setError("Recipe not found");
        }
      } catch (err) {
        console.error("Failed to load recipe:", err);
        setError("Failed to load recipe");
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchRecipe();
    }
  }, [session, params.id]);

  // Fetch ratings when recipe loads
  useEffect(() => {
    const fetchRatings = async () => {
      if (!params.id || !session) return;

      try {
        const response = await fetch(`/api/recipes/${params.id}/ratings`);
        if (response.ok) {
          const data = await response.json();
          setRatings(data.ratings || []);
          setCurrentUserRating(data.currentUserRating || null);
          setCurrentUserId(data.currentUserId || null);
        }
      } catch (err) {
        console.error("Failed to fetch ratings:", err);
      }
    };

    fetchRatings();
  }, [session, params.id]);

  // Fetch queue status
  useEffect(() => {
    const fetchQueueStatus = async () => {
      if (!params.id || !session) return;

      try {
        const response = await fetch(`/api/recipe-queue/by-recipe/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setIsQueued(data.queued);
          setQueueItemId(data.itemId);
        }
      } catch (err) {
        console.error("Failed to fetch queue status:", err);
      }
    };

    fetchQueueStatus();
  }, [session, params.id]);

  const handleToggleQueue = async () => {
    if (!params.id) return;

    try {
      if (isQueued) {
        const response = await fetch(`/api/recipe-queue/by-recipe/${params.id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          setIsQueued(false);
          setQueueItemId(null);
          showToast("Removed from queue");
        } else {
          showToast("Failed to remove from queue", "error");
        }
      } else {
        const response = await fetch("/api/recipe-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId: params.id }),
        });
        if (response.ok) {
          const data = await response.json();
          setIsQueued(true);
          setQueueItemId(data.item?.id || null);
          showToast("Added to queue");
        } else {
          showToast("Failed to add to queue", "error");
        }
      }
    } catch {
      showToast("Failed to update queue", "error");
    }
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === recipe?.name) {
      setIsEditingName(false);
      return;
    }

    try {
      const response = await fetch(`/api/recipes/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (response.ok) {
        setRecipe((prev) => (prev ? { ...prev, name: trimmed } : prev));
        showToast("Recipe renamed");
      } else {
        showToast("Failed to rename recipe", "error");
      }
    } catch {
      showToast("Failed to rename recipe", "error");
    } finally {
      setIsEditingName(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this recipe?")) return;

    try {
      const response = await fetch(`/api/recipes/${params.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/recipes");
      } else {
        alert("Failed to delete recipe");
      }
    } catch {
      alert("Failed to delete recipe");
    }
  };

  const handleImportIngredients = async () => {
    if (!recipe?.source_url) {
      setImportError("No source URL available for this recipe");
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportDebug(`Importing from: ${recipe.source_url}`);

    try {
      const startTime = Date.now();
      setImportDebug(`Fetching ingredients from: ${recipe.source_url}...`);

      const response = await fetch(`/api/recipes/${params.id}/import-ingredients`, {
        method: "POST",
      });

      const elapsed = Date.now() - startTime;
      const data = await response.json();

      if (response.ok) {
        const recipeData = data.recipe;
        const updates: string[] = [`${data.count} ingredients`];
        if (recipeData?.description) updates.push("description");
        if (recipeData?.category) updates.push("category");
        if (recipeData?.cuisine) updates.push("cuisine");
        setImportDebug(`Success! Imported ${updates.join(", ")} in ${elapsed}ms`);

        // Update recipe state with the new data
        setRecipe((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            description: recipeData?.description || prev.description,
            category: recipeData?.category || prev.category,
            cuisine: recipeData?.cuisine || prev.cuisine,
            recipe_ingredients: data.ingredients || prev.recipe_ingredients,
          };
        });
      } else {
        setImportDebug(`Failed after ${elapsed}ms. Status: ${response.status}`);
        setImportError(data.error || "Failed to import ingredients");
      }
    } catch (err) {
      console.error("Failed to import ingredients:", err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setImportDebug(`Exception: ${errorMsg}`);
      setImportError(`Failed to import ingredients: ${errorMsg}`);
    } finally {
      setIsImporting(false);
    }
  };

  const fetchAllIngredients = async () => {
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

  const handleStartEditing = () => {
    if (recipe) {
      setEditedIngredients([...recipe.recipe_ingredients]);
      setIsEditing(true);
      fetchAllIngredients();
    }
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditedIngredients([]);
    setShowAddIngredient(false);
    setIngredientSearch("");
  };

  const handleUpdateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number | undefined) => {
    setEditedIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveIngredient = (index: number) => {
    setEditedIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectIngredient = (ingredient: Ingredient) => {
    // Check if ingredient is already in the list
    const exists = editedIngredients.some(
      (ri) => ri.ingredient?.id === ingredient.id
    );
    if (exists) {
      alert("This ingredient is already in the recipe");
      return;
    }

    const newRecipeIngredient: RecipeIngredient = {
      id: `new-${Date.now()}`,
      sort_order: editedIngredients.length,
      ingredient: ingredient,
    };

    setEditedIngredients((prev) => [...prev, newRecipeIngredient]);
    setShowAddIngredient(false);
    setIngredientSearch("");
  };

  const handleCreateAndAddIngredient = async () => {
    if (!ingredientSearch.trim()) return;

    setIsCreatingIngredient(true);
    try {
      const response = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ingredientSearch.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        const newIngredient = data.ingredient;

        // Add to allIngredients list
        setAllIngredients((prev) => [...prev, newIngredient]);

        // Add to recipe ingredients
        handleSelectIngredient(newIngredient);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create ingredient");
      }
    } catch (err) {
      console.error("Failed to create ingredient:", err);
      alert("Failed to create ingredient");
    } finally {
      setIsCreatingIngredient(false);
    }
  };

  // Filter ingredients based on search and exclude already added ones
  const filteredIngredients = allIngredients.filter((ing) => {
    const matchesSearch = ing.name
      .toLowerCase()
      .includes(ingredientSearch.toLowerCase());
    const notAlreadyAdded = !editedIngredients.some(
      (ri) => ri.ingredient?.id === ing.id
    );
    return matchesSearch && notAlreadyAdded;
  });

  const handleSubmitRating = async (newRating: number) => {
    if (!params.id || isSubmittingRating) return;

    setIsSubmittingRating(true);
    try {
      const response = await fetch(`/api/recipes/${params.id}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: newRating }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update ratings list
        setRatings((prev) => {
          const existing = prev.findIndex(
            (r) => r.user.id === currentUserId
          );
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = data.rating;
            return updated;
          }
          return [...prev, data.rating];
        });
        setCurrentUserRating(data.rating);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save rating");
      }
    } catch (err) {
      console.error("Failed to submit rating:", err);
      alert("Failed to save rating");
    } finally {
      setIsSubmittingRating(false);
      setHoverRating(null);
    }
  };

  const handleSaveIngredients = async () => {
    try {
      const response = await fetch(`/api/recipes/${params.id}/ingredients`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: editedIngredients }),
      });

      if (response.ok) {
        // Refresh the recipe
        const recipeResponse = await fetch(`/api/recipes/${params.id}`);
        if (recipeResponse.ok) {
          const recipeData = await recipeResponse.json();
          setRecipe(recipeData.recipe);
        }
        setIsEditing(false);
      } else {
        alert("Failed to save ingredients");
      }
    } catch {
      alert("Failed to save ingredients");
    }
  };

  const handleUpdateMetric = async (field: "cost_rating" | "time_rating", newValue: number) => {
    if (!params.id || isSubmittingMetric) return;

    setIsSubmittingMetric(true);
    try {
      const response = await fetch(`/api/recipes/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });

      if (response.ok) {
        setRecipe((prev) => {
          if (!prev) return prev;
          return { ...prev, [field]: newValue };
        });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update rating");
      }
    } catch (err) {
      console.error("Failed to update metric:", err);
      alert("Failed to update rating");
    } finally {
      setIsSubmittingMetric(false);
      setHoverCostRating(null);
      setHoverTimeRating(null);
    }
  };

  const renderEditableMetric = (
    label: string,
    field: "cost_rating" | "time_rating",
    value?: number,
    hoverValue?: number | null,
    setHoverValue?: (v: number | null) => void,
    max: number = 5
  ) => {
    const displayValue = hoverValue != null ? hoverValue : (value || 0);
    return (
      <div className="flex items-center">
        <span className="text-sm text-gray-600 mr-2">{label}:</span>
        <div className="flex space-x-1">
          {[...Array(max)].map((_, i) => (
            <button
              key={i}
              onClick={() => handleUpdateMetric(field, i + 1)}
              onMouseEnter={() => setHoverValue?.(i + 1)}
              onMouseLeave={() => setHoverValue?.(null)}
              disabled={isSubmittingMetric}
              className={`w-4 h-4 rounded transition-colors cursor-pointer disabled:opacity-50 ${
                i < displayValue ? "bg-emerald-500" : "bg-gray-200 hover:bg-gray-300"
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-gray-500 ml-2">
          {hoverValue !== null ? hoverValue : (value || "-")}/{max}
        </span>
      </div>
    );
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view this recipe.</p>
      </div>
    );
  }

  if (isLoading) {
    return <RecipeDetailSkeleton />;
  }

  if (error || !recipe) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">{error || "Recipe not found"}</p>
          <Link
            href="/recipes"
            className="text-emerald-600 hover:text-emerald-700 mt-4 inline-block"
          >
            Back to recipes
          </Link>
        </div>
      </div>
    );
  }

  const ingredientsToShow = isEditing ? editedIngredients : recipe.recipe_ingredients;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/recipes"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to recipes
        </Link>
        <div>
          {isEditingName ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              className="text-2xl font-bold text-gray-900 w-full bg-transparent border-b-2 border-emerald-500 outline-none py-0.5"
              autoFocus
            />
          ) : (
            <h1
              className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-emerald-700 transition-colors group inline-flex items-center gap-2"
              onClick={() => {
                setEditName(recipe.name);
                setIsEditingName(true);
              }}
              title="Click to rename"
            >
              {recipe.name}
              <svg className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </h1>
          )}
          {recipe.source && (
            <p className="text-gray-600">
              {recipe.source_url ? (
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  {recipe.source} &rarr;
                </a>
              ) : (
                recipe.source
              )}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          {recipe.description && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Description
              </h2>
              <p className="text-gray-600">{recipe.description}</p>
            </div>
          )}

          {/* Ingredients */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Ingredients
                {recipe.servings && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    (serves {recipe.servings})
                  </span>
                )}
              </h2>
              <div className="flex space-x-2">
                {!isEditing && (
                  <button
                    onClick={handleStartEditing}
                    className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                )}
                {isEditing && (
                  <>
                    <button
                      onClick={handleCancelEditing}
                      className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveIngredients}
                      className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>

            {importDebug && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm font-mono">
                {importDebug}
              </div>
            )}

            {importError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <strong>Error:</strong> {importError}
              </div>
            )}

            {isEditing ? (
              <div className="space-y-3">
                {editedIngredients.length === 0 ? (
                  <p className="text-gray-500">No ingredients. Import from URL or add manually.</p>
                ) : (
                  editedIngredients.map((ri, index) => (
                    <div key={ri.id || index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                      <input
                        type="number"
                        value={ri.quantity || ""}
                        onChange={(e) => handleUpdateIngredient(index, "quantity", e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="Qty"
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <input
                        type="text"
                        value={ri.unit || ""}
                        onChange={(e) => handleUpdateIngredient(index, "unit", e.target.value || undefined)}
                        placeholder="Unit"
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <span className="flex-1 text-sm font-medium">
                        {ri.ingredient?.name || "Unknown"}
                      </span>
                      <input
                        type="text"
                        value={ri.notes || ""}
                        onChange={(e) => handleUpdateIngredient(index, "notes", e.target.value || undefined)}
                        placeholder="Notes"
                        className="w-32 px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <button
                        onClick={() => handleRemoveIngredient(index)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}

                {/* Add Ingredient Section */}
                {showAddIngredient ? (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={ingredientSearch}
                        onChange={(e) => setIngredientSearch(e.target.value)}
                        placeholder="Search or type new ingredient..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          setShowAddIngredient(false);
                          setIngredientSearch("");
                        }}
                        className="p-2 text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {ingredientSearch && (
                      <div className="mt-2 max-h-48 overflow-y-auto">
                        {filteredIngredients.length > 0 ? (
                          <ul className="divide-y divide-gray-200">
                            {filteredIngredients.slice(0, 10).map((ing) => (
                              <li
                                key={ing.id}
                                onClick={() => handleSelectIngredient(ing)}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-emerald-100 rounded"
                              >
                                {ing.name}
                                {ing.department && (
                                  <span className="text-gray-400 ml-2">({ing.department})</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {/* Option to create new ingredient */}
                        {ingredientSearch.trim() && !allIngredients.some(
                          (ing) => ing.name.toLowerCase() === ingredientSearch.toLowerCase()
                        ) && (
                          <button
                            onClick={handleCreateAndAddIngredient}
                            disabled={isCreatingIngredient}
                            className="w-full mt-2 px-3 py-2 text-sm text-left text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg disabled:opacity-50"
                          >
                            {isCreatingIngredient
                              ? "Creating..."
                              : `+ Create "${ingredientSearch.trim()}" as new ingredient`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddIngredient(true)}
                    className="mt-2 px-4 py-2 text-sm text-emerald-600 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Ingredient
                  </button>
                )}
              </div>
            ) : (
              <>
                {ingredientsToShow && ingredientsToShow.length > 0 ? (
                  <ul className="space-y-2">
                    {ingredientsToShow
                      .filter((ri) => ri.ingredient)
                      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                      .map((ri) => (
                        <li key={ri.id} className="flex items-start">
                          <span className="text-emerald-600 mr-2">*</span>
                          <span>
                            {ri.quantity && (
                              <span className="font-medium">{ri.quantity}</span>
                            )}
                            {ri.unit && <span className="ml-1">{ri.unit}</span>}
                            <span className="ml-1">{ri.ingredient?.name || "Unknown ingredient"}</span>
                            {ri.notes && (
                              <span className="text-gray-500 ml-1">
                                ({ri.notes})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No ingredients listed</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Instructions */}
          {recipe.instructions && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Instructions
              </h2>
              <div className="text-gray-600 whitespace-pre-wrap">
                {recipe.instructions}
              </div>
            </div>
          )}

          {/* Notes */}
          {recipe.notes && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{recipe.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Ratings */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ratings</h2>
            <div className="space-y-3">
              {/* Display all user ratings */}
              {ratings.length > 0 ? (
                ratings.map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {r.user.name || r.user.email.split("@")[0]}
                      {r.user.id === currentUserId && " (you)"}:
                    </span>
                    <div className="flex items-center">
                      <span className="text-amber-500">
                        {"★".repeat(r.rating)}
                        {"☆".repeat(5 - r.rating)}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">({r.rating})</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No ratings yet</p>
              )}

              {/* Rating input for current user */}
              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  {currentUserRating ? "Update your rating:" : "Rate this recipe:"}
                </p>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleSubmitRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      disabled={isSubmittingRating}
                      className="text-2xl transition-colors disabled:opacity-50"
                    >
                      <span
                        className={
                          (hoverRating !== null ? star <= hoverRating : star <= (currentUserRating?.rating || 0))
                            ? "text-amber-500"
                            : "text-gray-300"
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                  {isSubmittingRating && (
                    <span className="text-sm text-gray-500 ml-2">Saving...</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-4">
              {renderEditableMetric("Cost", "cost_rating", recipe.cost_rating, hoverCostRating, setHoverCostRating)}
              {renderEditableMetric("Time", "time_rating", recipe.time_rating, hoverTimeRating, setHoverTimeRating)}

              {recipe.category && (
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 mr-2">Category:</span>
                  <span className="capitalize">{recipe.category}</span>
                </div>
              )}

              {recipe.cuisine && (
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 mr-2">Cuisine:</span>
                  <span>{recipe.cuisine}</span>
                </div>
              )}

              {recipe.yields_leftovers && (
                <div className="flex items-center text-sm text-emerald-600">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Yields leftovers
                </div>
              )}

              {recipe.last_made && (
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 mr-2">Last made:</span>
                  <span>
                    {new Date(recipe.last_made).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {recipe.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Actions</h2>
            <div className="space-y-2">
              {recipe.source_url && (
                <>
                  <a
                    href={recipe.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full block text-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    View Original Recipe
                  </a>
                  <button
                    onClick={handleImportIngredients}
                    disabled={isImporting}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isImporting ? "Importing..." : "Import"}
                  </button>
                </>
              )}
              <button
                onClick={handleToggleQueue}
                className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  isQueued
                    ? "bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                }`}
              >
                {isQueued ? (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" />
                    </svg>
                    Remove from Queue
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Eat Soon
                  </>
                )}
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete Recipe
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-400 px-2">
            <p>Created: {new Date(recipe.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(recipe.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
