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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDepartment, setNewItemDepartment] = useState("Pantry");

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

  // Group items by department
  const itemsByDepartment = useMemo(() => {
    const grouped: Record<string, GroceryItemDraft[]> = {};

    wizard.groceryItems.forEach((item) => {
      const dept = item.department || "Other";
      if (!grouped[dept]) {
        grouped[dept] = [];
      }
      grouped[dept].push(item);
    });

    // Sort items within each department
    Object.keys(grouped).forEach((dept) => {
      grouped[dept].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
    });

    return grouped;
  }, [wizard.groceryItems]);

  // Sort departments by predefined order
  const sortedDepartments = useMemo(() => {
    const depts = Object.keys(itemsByDepartment);
    return depts.sort((a, b) => {
      const aIndex = DEPARTMENT_ORDER.indexOf(a);
      const bIndex = DEPARTMENT_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [itemsByDepartment]);

  // Toggle item expansion
  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
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
          Step 3 of 4: Review and customize your shopping list
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
            3
          </div>
          <span className="ml-2 text-sm font-medium text-gray-900">Groceries</span>
        </div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
            4
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

      {/* Grocery items by department */}
      <div className="space-y-6">
        {sortedDepartments.map((department) => (
          <div key={department} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{department}</h3>
                <span className="text-sm text-gray-500">
                  {itemsByDepartment[department].filter((i) => !i.checked).length}{" "}
                  items
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {itemsByDepartment[department].map((item) => {
                const isExpanded = expandedItems.has(item.id);
                const isEditing = editingItem?.id === item.id;
                const hasBreakdown = item.recipeBreakdown.length > 1;

                return (
                  <div
                    key={item.id}
                    className={`p-4 ${item.checked ? "opacity-50 bg-gray-50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => wizard.toggleGroceryItemChecked(item.id)}
                        className="mt-1 h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />

                      {/* Item content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Name */}
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
                              className="px-2 py-1 border border-emerald-500 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                          ) : (
                            <span
                              className={`font-medium text-gray-900 ${item.checked ? "line-through" : ""} cursor-pointer hover:text-emerald-600`}
                              onClick={() => handleEdit(item, "name")}
                            >
                              {item.ingredientName}
                            </span>
                          )}

                          {/* Quantity */}
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
                              className="text-sm text-gray-500 cursor-pointer hover:text-emerald-600"
                              onClick={() => handleEdit(item, "quantity")}
                            >
                              {item.totalQuantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
                          )}

                          {/* Manual add badge */}
                          {item.isManualAdd && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                              Added
                            </span>
                          )}
                        </div>

                        {/* Recipe breakdown toggle */}
                        {hasBreakdown && (
                          <button
                            onClick={() => toggleExpanded(item.id)}
                            className="mt-1 text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"
                          >
                            <svg
                              className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                            Used in {item.recipeBreakdown.length} recipes
                          </button>
                        )}

                        {/* Expanded breakdown */}
                        {isExpanded && (
                          <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-1">
                            {item.recipeBreakdown.map((breakdown, idx) => (
                              <div key={idx} className="text-xs text-gray-500">
                                {breakdown.quantity}
                                {breakdown.unit ? ` ${breakdown.unit}` : ""} for{" "}
                                <span className="text-gray-700">
                                  {breakdown.recipeName}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Single recipe reference */}
                        {!hasBreakdown && item.recipeBreakdown.length === 1 && (
                          <div className="mt-1 text-xs text-gray-400">
                            for {item.recipeBreakdown[0].recipeName}
                          </div>
                        )}
                      </div>

                      {/* Remove button */}
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
          href="/weekly-plans/create/review"
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
        >
          <span>&lt;-</span>
          Back to Review
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
