"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Recipe {
  id: string;
  name: string;
  status: string;
}

interface Store {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  sort_order: number;
}

interface RecipeIngredient {
  id: string;
  quantity?: number;
  unit?: string;
  recipe: Recipe;
}

interface Ingredient {
  id: string;
  name: string;
  department?: string;
  store?: {
    id: string;
    name: string;
  };
  created_at: string;
  recipe_ingredients: RecipeIngredient[];
}

export default function IngredientDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Details editing state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editedDepartment, setEditedDepartment] = useState("");
  const [editedStoreId, setEditedStoreId] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isAutoAssigningDepartment, setIsAutoAssigningDepartment] = useState(false);

  useEffect(() => {
    const fetchIngredient = async () => {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/ingredients/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setIngredient(data.ingredient);
        } else {
          setError("Ingredient not found");
        }
      } catch (err) {
        console.error("Failed to load ingredient:", err);
        setError("Failed to load ingredient");
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchIngredient();
    }
  }, [session, params.id]);

  // Auto-assign department if missing
  useEffect(() => {
    const autoAssignDepartment = async () => {
      if (!ingredient || ingredient.department || isAutoAssigningDepartment) return;

      setIsAutoAssigningDepartment(true);
      try {
        const response = await fetch(`/api/ingredients/${ingredient.id}/auto-department`, {
          method: "POST",
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.alreadySet && data.department) {
            setIngredient((prev) =>
              prev ? { ...prev, department: data.department } : null
            );
          }
        }
      } catch (err) {
        console.error("Failed to auto-assign department:", err);
      } finally {
        setIsAutoAssigningDepartment(false);
      }
    };

    autoAssignDepartment();
  }, [ingredient?.id, ingredient?.department, isAutoAssigningDepartment]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this ingredient?")) return;

    try {
      const response = await fetch(`/api/ingredients/${params.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/ingredients");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete ingredient");
      }
    } catch {
      alert("Failed to delete ingredient");
    }
  };

  const handleStartEditing = () => {
    if (ingredient) {
      setEditedName(ingredient.name);
      setIsEditing(true);
    }
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditedName("");
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      alert("Name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/ingredients/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedName.trim(),
          department: ingredient?.department,
          store_id: ingredient?.store?.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIngredient((prev) =>
          prev ? { ...prev, name: data.ingredient.name } : null
        );
        setIsEditing(false);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update ingredient");
      }
    } catch {
      alert("Failed to update ingredient");
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch stores and departments for dropdowns
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch("/api/stores");
        if (response.ok) {
          const data = await response.json();
          setStores(data.stores || []);
        }
      } catch (err) {
        console.error("Failed to fetch stores:", err);
      }
    };

    const fetchDepartments = async () => {
      try {
        const response = await fetch("/api/departments");
        if (response.ok) {
          const data = await response.json();
          setDepartments(data.departments || []);
        }
      } catch (err) {
        console.error("Failed to fetch departments:", err);
      }
    };

    if (session) {
      fetchStores();
      fetchDepartments();
    }
  }, [session]);

  const handleStartEditingDetails = () => {
    if (ingredient) {
      setEditedDepartment(ingredient.department || "");
      setEditedStoreId(ingredient.store?.id || null);
      setIsEditingDetails(true);
    }
  };

  const handleCancelEditingDetails = () => {
    setIsEditingDetails(false);
    setEditedDepartment("");
    setEditedStoreId(null);
  };

  const handleSaveDetails = async () => {
    setIsSavingDetails(true);
    try {
      const response = await fetch(`/api/ingredients/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ingredient?.name,
          department: editedDepartment || null,
          store_id: editedStoreId || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Find the store object for the updated store_id
        const updatedStore = editedStoreId
          ? stores.find((s) => s.id === editedStoreId)
          : undefined;
        setIngredient((prev) =>
          prev
            ? {
                ...prev,
                department: data.ingredient.department,
                store: updatedStore,
              }
            : null
        );
        setIsEditingDetails(false);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update ingredient");
      }
    } catch {
      alert("Failed to update ingredient");
    } finally {
      setIsSavingDetails(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view this ingredient.</p>
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

  if (error || !ingredient) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">{error || "Ingredient not found"}</p>
          <Link
            href="/ingredients"
            className="text-emerald-600 hover:text-emerald-700 mt-4 inline-block"
          >
            Back to ingredients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/ingredients"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to ingredients
        </Link>
        {isEditing ? (
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="text-2xl font-bold text-gray-900 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") handleCancelEditing();
              }}
            />
            <button
              onClick={handleSaveName}
              disabled={isSaving}
              className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleCancelEditing}
              disabled={isSaving}
              className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">{ingredient.name}</h1>
            <button
              onClick={handleStartEditing}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Edit name"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2">
          {/* Recipes using this ingredient */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Used in Recipes
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({ingredient.recipe_ingredients?.length || 0})
              </span>
            </h2>
            {ingredient.recipe_ingredients &&
            ingredient.recipe_ingredients.filter((ri) => ri.recipe).length > 0 ? (
              <ul className="space-y-2">
                {ingredient.recipe_ingredients
                  .filter((ri) => ri.recipe)
                  .map((ri) => (
                  <li
                    key={ri.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <Link
                      href={`/recipes/${ri.recipe.id}`}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      {ri.recipe.name}
                    </Link>
                    <div className="flex items-center space-x-3">
                      {ri.quantity && (
                        <span className="text-sm text-gray-500">
                          {ri.quantity} {ri.unit}
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          ri.recipe.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : ri.recipe.status === "wishlist"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {ri.recipe.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">
                This ingredient is not used in any recipes yet.
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Details</h2>
              {!isEditingDetails && (
                <button
                  onClick={handleStartEditingDetails}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Edit details"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
            {isEditingDetails ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Department:</label>
                  <select
                    value={editedDepartment}
                    onChange={(e) => setEditedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Not assigned</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                    {editedDepartment &&
                      !departments.some((d) => d.name === editedDepartment) && (
                        <option value={editedDepartment}>
                          {editedDepartment}
                        </option>
                      )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Preferred Store:</label>
                  <select
                    value={editedStoreId || ""}
                    onChange={(e) => setEditedStoreId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Not assigned</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveDetails}
                    disabled={isSavingDetails}
                    className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {isSavingDetails ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancelEditingDetails}
                    disabled={isSavingDetails}
                    className="flex-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Department:</span>
                  <p className="font-medium">
                    {isAutoAssigningDepartment ? (
                      <span className="flex items-center text-gray-500">
                        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Auto-assigning...
                      </span>
                    ) : (
                      ingredient.department || "Not assigned"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Preferred Store:</span>
                  <p className="font-medium">
                    {ingredient.store ? (
                      <Link
                        href={`/stores/${ingredient.store.id}`}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        {ingredient.store.name}
                      </Link>
                    ) : (
                      "Not assigned"
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Actions</h2>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete Ingredient
            </button>
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-400 px-2">
            <p>Created: {new Date(ingredient.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
