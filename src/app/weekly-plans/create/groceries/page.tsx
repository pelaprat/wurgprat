"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useMealPlanWizard,
  GroceryItemDraft,
} from "@/contexts/MealPlanWizardContext";

// Department order for display
const DEPARTMENT_ORDER = [
  "Produce",
  "Meat & Seafood",
  "Dairy",
  "Bakery",
  "Frozen",
  "Pantry",
  "Canned Goods",
  "Condiments",
  "Spices",
  "Beverages",
  "Snacks",
  "Other",
];

interface Store {
  id: string;
  name: string;
}

interface EditingItem {
  id: string;
  field: "name" | "quantity";
  value: string;
}

export default function GroceriesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const wizard = useMealPlanWizard();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDepartment, setNewItemDepartment] = useState("Pantry");
  const [sortBy, setSortBy] = useState<"ingredient" | "department" | "store">("department");

  // Fetch stores on mount
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
    if (session) {
      fetchStores();
    }
  }, [session]);

  // Redirect if no meals proposed yet
  useEffect(() => {
    if (!wizard.proposedMeals || wizard.proposedMeals.length === 0) {
      router.replace("/weekly-plans/create/input");
      return;
    }

    // Generate grocery list if not already done
    if (wizard.groceryItems.length === 0 && !isLoading) {
      generateGroceryList();
    }
  }, [wizard.proposedMeals, wizard.groceryItems.length]);

  const generateGroceryList = async () => {
    setIsLoading(true);
    setError(null);
    wizard.setIsGeneratingGroceries(true);

    try {
      const response = await fetch("/api/weekly-plans/generate-grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meals: wizard.proposedMeals,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate grocery list");
      }

      const data = await response.json();
      wizard.setGroceryItems(data.groceryItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
      wizard.setIsGeneratingGroceries(false);
    }
  };

  // Sorted grocery items
  const sortedItems = useMemo(() => {
    const items = [...wizard.groceryItems].filter((i) => !i.checked);

    items.sort((a, b) => {
      if (sortBy === "ingredient") {
        return a.ingredientName.localeCompare(b.ingredientName);
      } else if (sortBy === "store") {
        const aStore = a.storeName || "No store";
        const bStore = b.storeName || "No store";
        if (aStore !== bStore) return aStore.localeCompare(bStore);
        return a.ingredientName.localeCompare(b.ingredientName);
      } else {
        // Default: sort by department
        const aIndex = DEPARTMENT_ORDER.indexOf(a.department || "Other");
        const bIndex = DEPARTMENT_ORDER.indexOf(b.department || "Other");
        const aDeptOrder = aIndex === -1 ? 999 : aIndex;
        const bDeptOrder = bIndex === -1 ? 999 : bIndex;
        if (aDeptOrder !== bDeptOrder) return aDeptOrder - bDeptOrder;
        return a.ingredientName.localeCompare(b.ingredientName);
      }
    });

    return items;
  }, [wizard.groceryItems, sortBy]);

  // Handle store change
  const handleStoreChange = (itemId: string, storeId: string) => {
    const store = stores.find((s) => s.id === storeId);
    wizard.updateGroceryItem(itemId, {
      storeId: storeId || undefined,
      storeName: store?.name || undefined,
    });
  };

  // Handle inline edit
  const handleEdit = (item: GroceryItemDraft, field: "name" | "quantity") => {
    setEditingItem({
      id: item.id,
      field,
      value: field === "name" ? item.ingredientName : item.totalQuantity,
    });
  };

  const handleEditSave = () => {
    if (!editingItem) return;

    wizard.updateGroceryItem(editingItem.id, {
      [editingItem.field === "name" ? "ingredientName" : "totalQuantity"]:
        editingItem.value,
    });
    setEditingItem(null);
  };

  const handleEditCancel = () => {
    setEditingItem(null);
  };

  // Handle add new item
  const handleAddItem = () => {
    if (!newItemName.trim()) return;

    wizard.addGroceryItem({
      ingredientName: newItemName.trim(),
      department: newItemDepartment,
      totalQuantity: "1",
      unit: "",
      recipeBreakdown: [],
      isManualAdd: true,
      checked: false,
    });

    setNewItemName("");
  };

  // Handle continue
  const handleContinue = () => {
    router.push("/weekly-plans/create/finalize");
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
          <p className="text-gray-600">Generating grocery list from recipes...</p>
        </div>
      </div>
    );
  }

  const totalItems = wizard.groceryItems.length;
  const checkedItems = wizard.groceryItems.filter((i) => i.checked).length;

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
          <span className="text-gray-900">Groceries</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Grocery List</h1>
        <p className="text-gray-600 mt-1">
          Step 4 of 5: Review and customize your shopping list
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
            4
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Groceries</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            5
          </div>
          <span className="ml-2 text-sm text-gray-500">Finalize</span>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-600">
            {totalItems} items from {wizard.proposedMeals.length} meals
          </span>
          {checkedItems > 0 && (
            <span className="text-sm text-gray-400 ml-2">
              ({checkedItems} removed)
            </span>
          )}
        </div>
        <button
          onClick={generateGroceryList}
          className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          Regenerate list
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
          <button
            onClick={generateGroceryList}
            className="mt-2 text-sm text-red-600 hover:text-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {/* Add new item */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Add Additional Items
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Item name (e.g., paper towels)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
          <select
            value={newItemDepartment}
            onChange={(e) => setNewItemDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
          >
            {DEPARTMENT_ORDER.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddItem}
            disabled={!newItemName.trim()}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Grocery items table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Sort controls */}
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Sort by:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy("department")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                sortBy === "department"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Department
            </button>
            <button
              onClick={() => setSortBy("ingredient")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                sortBy === "ingredient"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Ingredient
            </button>
            <button
              onClick={() => setSortBy("store")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                sortBy === "store"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Store
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ingredient
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Recipes
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Store
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">

                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedItems.map((item) => {
                const isEditing = editingItem?.id === item.id;

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {/* Ingredient name */}
                    <td className="px-4 py-3">
                      {isEditing && editingItem.field === "name" ? (
                        <input
                          type="text"
                          value={editingItem.value}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              value: e.target.value,
                            })
                          }
                          onBlur={handleEditSave}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave();
                            if (e.key === "Escape") handleEditCancel();
                          }}
                          autoFocus
                          className="px-2 py-1 border border-emerald-500 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full"
                        />
                      ) : (
                        <span
                          className="font-medium text-gray-900 cursor-pointer hover:text-emerald-600"
                          onClick={() => handleEdit(item, "name")}
                        >
                          {item.ingredientName}
                          {item.isManualAdd && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                              Added
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3">
                      {isEditing && editingItem.field === "quantity" ? (
                        <input
                          type="text"
                          value={editingItem.value}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              value: e.target.value,
                            })
                          }
                          onBlur={handleEditSave}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave();
                            if (e.key === "Escape") handleEditCancel();
                          }}
                          autoFocus
                          className="w-20 px-2 py-1 border border-emerald-500 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      ) : (
                        <span
                          className="text-sm text-gray-700 cursor-pointer hover:text-emerald-600"
                          onClick={() => handleEdit(item, "quantity")}
                        >
                          {item.totalQuantity}
                          {item.unit ? ` ${item.unit}` : ""}
                        </span>
                      )}
                    </td>

                    {/* Recipes */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {item.recipeBreakdown.length > 0 ? (
                          item.recipeBreakdown.map((breakdown, idx) => (
                            <span key={idx}>
                              {idx > 0 && ", "}
                              {breakdown.recipeName}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {item.department || "Other"}
                      </span>
                    </td>

                    {/* Store */}
                    <td className="px-4 py-3">
                      <select
                        value={item.storeId || ""}
                        onChange={(e) => handleStoreChange(item.id, e.target.value)}
                        className="text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                      >
                        <option value="">No store</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Remove */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => wizard.removeGroceryItem(item.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove item"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty state */}
      {wizard.groceryItems.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No grocery items yet.</p>
          <button
            onClick={generateGroceryList}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Generate grocery list
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex justify-between items-center">
        <Link
          href="/weekly-plans/create/events"
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
        >
          <span>&lt;-</span>
          Back to Events
        </Link>
        <button
          onClick={handleContinue}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          Review Final Plan
          <span className="text-emerald-200">-&gt;</span>
        </button>
      </div>
    </div>
  );
}
