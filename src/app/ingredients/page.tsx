"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Store {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  sort_order: number;
}

interface Ingredient {
  id: string;
  name: string;
  department?: string;
  department_id?: string;
  store?: Store;
  store_id?: string;
  created_at: string;
}

interface DuplicateIngredient {
  id: string;
  name: string;
  department?: string;
}

interface DuplicateGroup {
  ingredients: DuplicateIngredient[];
  similarity: string;
}

type SortField = "name" | "department" | "store";
type SortOrder = "asc" | "desc";

export default function IngredientsPage() {
  const { data: session } = useSession();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // De-duplication state
  const [showDedupeModal, setShowDedupeModal] = useState(false);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedToKeep, setSelectedToKeep] = useState<Record<number, string>>({});
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResults, setMergeResults] = useState<string | null>(null);

  // Manual merge selection state
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [isMergingManual, setIsMergingManual] = useState(false);

  // Stores state
  const [stores, setStores] = useState<Store[]>([]);

  // Departments state
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);

  useEffect(() => {
    if (session) {
      fetchIngredients();
      fetchStores();
      fetchDepartments();
    }
  }, [session]);

  const fetchIngredients = async () => {
    try {
      const response = await fetch("/api/ingredients");
      if (response.ok) {
        const data = await response.json();
        setIngredients(data.ingredients || []);
      }
    } catch (error) {
      console.error("Failed to fetch ingredients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await fetch("/api/stores");
      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
      }
    } catch (error) {
      console.error("Failed to fetch stores:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartmentsList(data.departments || []);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const handleUpdateIngredient = async (
    id: string,
    field: "department" | "store_id",
    value: string | null
  ) => {
    try {
      const response = await fetch(`/api/ingredients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        const data = await response.json();
        setIngredients((prev) =>
          prev.map((ing) => (ing.id === id ? data.ingredient : ing))
        );
      }
    } catch (error) {
      console.error("Failed to update ingredient:", error);
    }
  };

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set<string>();
    ingredients.forEach((i) => {
      if (i.department) depts.add(i.department);
    });
    return Array.from(depts).sort();
  }, [ingredients]);

  const filteredAndSortedIngredients = useMemo(() => {
    let result = [...ingredients];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((i) =>
        i.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply department filter
    if (departmentFilter) {
      result = result.filter((i) => i.department === departmentFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string = "";
      let bVal: string = "";

      if (sortField === "name") {
        aVal = a.name || "";
        bVal = b.name || "";
      } else if (sortField === "department") {
        aVal = a.department || "";
        bVal = b.department || "";
      } else if (sortField === "store") {
        aVal = a.store?.name || "";
        bVal = b.store?.name || "";
      }

      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

    return result;
  }, [ingredients, search, departmentFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleFindDuplicates = async () => {
    setShowDedupeModal(true);
    setIsLoadingDuplicates(true);
    setMergeResults(null);
    setSelectedToKeep({});

    try {
      const response = await fetch("/api/ingredients/duplicates");
      if (response.ok) {
        const data = await response.json();
        setDuplicateGroups(data.duplicateGroups || []);
        // Auto-select first ingredient in each group as default
        const defaults: Record<number, string> = {};
        data.duplicateGroups?.forEach((group: DuplicateGroup, index: number) => {
          if (group.ingredients.length > 0) {
            defaults[index] = group.ingredients[0].id;
          }
        });
        setSelectedToKeep(defaults);
      }
    } catch (error) {
      console.error("Failed to find duplicates:", error);
    } finally {
      setIsLoadingDuplicates(false);
    }
  };

  const handleMergeGroup = async (groupIndex: number) => {
    const group = duplicateGroups[groupIndex];
    const keepId = selectedToKeep[groupIndex];
    if (!keepId || !group) return;

    const deleteIds = group.ingredients
      .filter((ing) => ing.id !== keepId)
      .map((ing) => ing.id);

    if (deleteIds.length === 0) return;

    setIsMerging(true);
    try {
      const response = await fetch("/api/ingredients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, deleteIds }),
      });

      if (response.ok) {
        const data = await response.json();
        setMergeResults(`Merged ${deleteIds.length} duplicate(s) successfully!`);
        // Remove the merged group from the list
        setDuplicateGroups((prev) => prev.filter((_, i) => i !== groupIndex));
        // Refresh ingredients list
        fetchIngredients();
      } else {
        const error = await response.json();
        setMergeResults(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to merge:", error);
      setMergeResults("Failed to merge ingredients");
    } finally {
      setIsMerging(false);
    }
  };

  const handleMergeAll = async () => {
    setIsMerging(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i];
      const keepId = selectedToKeep[i];
      if (!keepId || !group) continue;

      const deleteIds = group.ingredients
        .filter((ing) => ing.id !== keepId)
        .map((ing) => ing.id);

      if (deleteIds.length === 0) continue;

      try {
        const response = await fetch("/api/ingredients/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keepId, deleteIds }),
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setMergeResults(
      `Merged ${successCount} group(s) successfully${errorCount > 0 ? `, ${errorCount} failed` : ""}`
    );
    setDuplicateGroups([]);
    fetchIngredients();
    setIsMerging(false);
  };

  const closeDedupeModal = () => {
    setShowDedupeModal(false);
    setDuplicateGroups([]);
    setSelectedToKeep({});
    setMergeResults(null);
  };

  const toggleMergeSelection = (id: string) => {
    setSelectedForMerge((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleManualMerge = async (keepId: string) => {
    const deleteIds = Array.from(selectedForMerge).filter((id) => id !== keepId);
    if (deleteIds.length === 0) {
      alert("Please select at least one other ingredient to merge");
      return;
    }

    const keepIngredient = ingredients.find((i) => i.id === keepId);
    const mergeIngredients = ingredients.filter((i) => deleteIds.includes(i.id));
    const mergeNames = mergeIngredients.map((i) => i.name).join(", ");

    if (!confirm(`Merge "${mergeNames}" into "${keepIngredient?.name}"?\n\nThis will update all recipes using those ingredients to use "${keepIngredient?.name}" instead.`)) {
      return;
    }

    setIsMergingManual(true);
    try {
      const response = await fetch("/api/ingredients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, deleteIds }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully merged ${deleteIds.length} ingredient(s)! Updated ${data.updatedRecipeIngredients || 0} recipe link(s).`);
        setSelectedForMerge(new Set());
        fetchIngredients();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to merge:", error);
      alert("Failed to merge ingredients");
    } finally {
      setIsMergingManual(false);
    }
  };

  const clearMergeSelection = () => {
    setSelectedForMerge(new Set());
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

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view ingredients.</p>
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
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ingredients</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleFindDuplicates}
            className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Find Duplicates
          </button>
          <span className="text-sm text-gray-500">
            {filteredAndSortedIngredients.length} of {ingredients.length} ingredients
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ingredients..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">All</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
                setDepartmentFilter("");
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* Selection Info Bar */}
      {selectedForMerge.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-blue-700 font-medium">
              {selectedForMerge.size} ingredient{selectedForMerge.size > 1 ? "s" : ""} selected
            </span>
            <span className="text-blue-600 text-sm ml-2">
              - Click &quot;Merge into this&quot; on the ingredient you want to keep
            </span>
          </div>
          <button
            onClick={clearMergeSelection}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-12 px-4 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("department")}
                >
                  Department <SortIcon field="department" />
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("store")}
                >
                  Preferred Store <SortIcon field="store" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedIngredients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No ingredients found
                  </td>
                </tr>
              ) : (
                filteredAndSortedIngredients.map((ingredient) => (
                  <tr
                    key={ingredient.id}
                    className={`transition-colors ${
                      selectedForMerge.has(ingredient.id)
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedForMerge.has(ingredient.id)}
                        onChange={() => toggleMergeSelection(ingredient.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/ingredients/${ingredient.id}`}
                          className="text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          {ingredient.name}
                        </Link>
                        {selectedForMerge.size > 0 && (
                          <button
                            onClick={() => handleManualMerge(ingredient.id)}
                            disabled={isMergingManual}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${
                              selectedForMerge.has(ingredient.id) && selectedForMerge.size === 1
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            }`}
                            title={
                              selectedForMerge.has(ingredient.id) && selectedForMerge.size === 1
                                ? "Select other ingredients to merge"
                                : `Merge ${selectedForMerge.size - (selectedForMerge.has(ingredient.id) ? 1 : 0)} ingredient(s) into this one`
                            }
                          >
                            {isMergingManual ? "..." : "Merge into this"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={ingredient.department || ""}
                        onChange={(e) =>
                          handleUpdateIngredient(
                            ingredient.id,
                            "department",
                            e.target.value || null
                          )
                        }
                        className="w-full text-sm border-0 bg-transparent text-gray-600 focus:ring-2 focus:ring-emerald-500 rounded cursor-pointer hover:bg-gray-100 py-1 px-2 -ml-2"
                      >
                        <option value="">-</option>
                        {departmentsList.map((dept) => (
                          <option key={dept.id} value={dept.name}>
                            {dept.name}
                          </option>
                        ))}
                        {ingredient.department &&
                          !departmentsList.some(d => d.name === ingredient.department) && (
                            <option value={ingredient.department}>
                              {ingredient.department}
                            </option>
                          )}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={ingredient.store?.id || ""}
                        onChange={(e) =>
                          handleUpdateIngredient(
                            ingredient.id,
                            "store_id",
                            e.target.value || null
                          )
                        }
                        className="w-full text-sm border-0 bg-transparent text-gray-600 focus:ring-2 focus:ring-emerald-500 rounded cursor-pointer hover:bg-gray-100 py-1 px-2 -ml-2"
                      >
                        <option value="">-</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* De-duplication Modal */}
      {showDedupeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                De-duplicate Ingredients
              </h2>
              <button
                onClick={closeDedupeModal}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {isLoadingDuplicates ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <span className="ml-2 text-gray-600">Finding duplicates...</span>
                </div>
              ) : duplicateGroups.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-emerald-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg font-medium text-gray-900">No duplicates found!</p>
                  <p className="text-gray-500 mt-1">All your ingredients are unique.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Found {duplicateGroups.length} group(s) of potential duplicates.
                    Select which ingredient to keep in each group. The others will be merged into it.
                  </p>

                  {duplicateGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-sm font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                            {group.similarity}
                          </span>
                        </div>
                        <button
                          onClick={() => handleMergeGroup(groupIndex)}
                          disabled={isMerging}
                          className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          Merge
                        </button>
                      </div>
                      <div className="space-y-2">
                        {group.ingredients.map((ing) => (
                          <label
                            key={ing.id}
                            className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                              selectedToKeep[groupIndex] === ing.id
                                ? "bg-emerald-100 border border-emerald-300"
                                : "bg-white border border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`group-${groupIndex}`}
                              value={ing.id}
                              checked={selectedToKeep[groupIndex] === ing.id}
                              onChange={() =>
                                setSelectedToKeep((prev) => ({
                                  ...prev,
                                  [groupIndex]: ing.id,
                                }))
                              }
                              className="mr-3 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1">
                              <span className="font-medium">{ing.name}</span>
                              {ing.department && (
                                <span className="text-sm text-gray-500 ml-2">
                                  ({ing.department})
                                </span>
                              )}
                            </div>
                            {selectedToKeep[groupIndex] === ing.id && (
                              <span className="text-xs text-emerald-600 font-medium">
                                KEEP
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mergeResults && (
                <div className={`mt-4 p-3 rounded-lg ${
                  mergeResults.startsWith("Error")
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  {mergeResults}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {duplicateGroups.length > 0 && (
              <div className="p-4 border-t bg-gray-50 flex justify-between">
                <button
                  onClick={closeDedupeModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMergeAll}
                  disabled={isMerging}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {isMerging ? "Merging..." : `Merge All ${duplicateGroups.length} Groups`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
