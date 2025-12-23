"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Recipe {
  id: string;
  name: string;
  description?: string;
  source?: string;
  source_url?: string;
  servings?: number;
  cost_rating?: number;
  time_rating?: number;
  average_rating?: number;
  yields_leftovers?: boolean;
  category?: string;
  cuisine?: string;
  status: string;
  tags?: string[];
  last_made?: string;
  created_at: string;
  recipe_ingredients?: { count: number }[];
}

type SortField = "name" | "cuisine" | "average_rating";
type SortOrder = "asc" | "desc";

export default function RecipesPage() {
  const { data: session } = useSession();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  useEffect(() => {
    if (session) {
      fetchRecipes();
    }
  }, [session]);

  const fetchRecipes = async () => {
    try {
      const response = await fetch("/api/recipes");
      if (response.ok) {
        const data = await response.json();
        setRecipes(data.recipes || []);
      }
    } catch (error) {
      console.error("Failed to fetch recipes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedRecipes = useMemo(() => {
    let result = [...recipes];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(searchLower) ||
          r.cuisine?.toLowerCase().includes(searchLower) ||
          r.source?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      // Compare
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return result;
  }, [recipes, search, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">&#8597;</span>;
    }
    return sortOrder === "asc" ? (
      <span className="text-emerald-600 ml-1">&#8593;</span>
    ) : (
      <span className="text-emerald-600 ml-1">&#8595;</span>
    );
  };

  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-gray-400">-</span>;
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    return (
      <span className="text-amber-500">
        {"★".repeat(fullStars)}
        {hasHalf && "½"}
        {"☆".repeat(5 - fullStars - (hasHalf ? 1 : 0))}
      </span>
    );
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view recipes.</p>
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/recipes/new"
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + New Recipe
          </Link>
          <span className="text-sm text-gray-500">
            {filteredAndSortedRecipes.length} of {recipes.length} recipes
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("cuisine")}
                >
                  Cuisine <SortIcon field="cuisine" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Ingredients
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("average_rating")}
                >
                  Rating <SortIcon field="average_rating" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedRecipes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No recipes found
                  </td>
                </tr>
              ) : (
                filteredAndSortedRecipes.map((recipe) => (
                  <tr
                    key={recipe.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/recipes/${recipe.id}`}
                        className="text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {recipe.name}
                      </Link>
                      {recipe.source && (
                        <span className="text-xs text-gray-500 block">
                          {recipe.source}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {recipe.cuisine || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(() => {
                        const count = recipe.recipe_ingredients?.[0]?.count || 0;
                        if (count === 0) {
                          return (
                            <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                              Not fetched
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800">
                            {count} items
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {renderStars(recipe.average_rating)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
