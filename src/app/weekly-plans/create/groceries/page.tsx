"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useMealPlanWizard,
  GroceryItemDraft,
} from "@/contexts/MealPlanWizardContext";
import { DEPARTMENT_ORDER, getDepartmentSortIndexForStore } from "@/constants/grocery";
import WizardProgress from "@/components/WizardProgress";

const WIZARD_STEPS = [
  { id: "review", label: "Meals", href: "/weekly-plans/create/review" },
  { id: "staples", label: "Staples", href: "/weekly-plans/create/staples" },
  { id: "events", label: "Events", href: "/weekly-plans/create/events" },
  { id: "groceries", label: "Groceries", href: "/weekly-plans/create/groceries" },
];

interface Store {
  id: string;
  name: string;
  department_order?: string[] | null;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDepartment, setNewItemDepartment] = useState("Pantry");

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
      router.replace("/weekly-plans/create/review");
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
          stapleItems: wizard.stapleItems,
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

  // Create a map of store name to store info for quick lookup
  const storeInfoMap = useMemo(() => {
    const map = new Map<string, { sortOrder: number; departmentOrder: string[] | null }>();
    stores.forEach((store, index) => {
      map.set(store.name, {
        sortOrder: index, // Use the index since stores are already ordered by sort_order from API
        departmentOrder: store.department_order || null,
      });
    });
    return map;
  }, [stores]);

  // Group by store, then by department within each store
  const groceryItemsByStoreAndDept = useMemo(() => {
    const items = wizard.groceryItems.filter((i) => !i.checked);

    // First, group by store
    const byStore = new Map<string, GroceryItemDraft[]>();
    items.forEach((item) => {
      const store = item.storeName || "No Store Assigned";
      if (!byStore.has(store)) {
        byStore.set(store, []);
      }
      byStore.get(store)!.push(item);
    });

    // Then, within each store, group by department
    const result = new Map<string, Map<string, GroceryItemDraft[]>>();
    byStore.forEach((storeItems, storeName) => {
      const byDept = new Map<string, GroceryItemDraft[]>();
      storeItems.forEach((item) => {
        const dept = item.department || "Other";
        if (!byDept.has(dept)) {
          byDept.set(dept, []);
        }
        byDept.get(dept)!.push(item);
      });

      // Sort items within each department by name
      byDept.forEach((deptItems) => {
        deptItems.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
      });

      // Sort departments using store's custom order if available
      const storeInfo = storeInfoMap.get(storeName);
      const sortedDepts = Array.from(byDept.entries()).sort((a, b) => {
        return getDepartmentSortIndexForStore(a[0], storeInfo?.departmentOrder) - getDepartmentSortIndexForStore(b[0], storeInfo?.departmentOrder);
      });

      result.set(storeName, new Map(sortedDepts));
    });

    // Sort stores by their sort_order (No Store Assigned last)
    const sortedStores = Array.from(result.entries()).sort((a, b) => {
      if (a[0] === "No Store Assigned") return 1;
      if (b[0] === "No Store Assigned") return -1;
      const aInfo = storeInfoMap.get(a[0]);
      const bInfo = storeInfoMap.get(b[0]);
      // If store not found in map, put it before "No Store Assigned" but after known stores
      if (aInfo === undefined && bInfo === undefined) return a[0].localeCompare(b[0]);
      if (aInfo === undefined) return 1;
      if (bInfo === undefined) return -1;
      return aInfo.sortOrder - bInfo.sortOrder;
    });

    return new Map(sortedStores);
  }, [wizard.groceryItems, storeInfoMap]);

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
      isStaple: false,
      checked: false,
    });

    setNewItemName("");
  };

  // Handle finalize - create the weekly plan
  const handleFinalize = async () => {
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

      // Reset wizard after successful creation
      wizard.resetWizard();

      // Redirect to home page
      router.push("/");
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
            href="/weekly-plans/create/review"
            className="hover:text-emerald-600 transition-colors"
          >
            Create
          </Link>
          <span>/</span>
          <span className="text-gray-900">Groceries</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Grocery List</h1>
        <WizardProgress steps={WIZARD_STEPS} currentStep="groceries" />
        <p className="text-gray-600">
          Review your shopping list and finalize your plan
        </p>
      </div>

      {/* Old progress indicator - hidden */}
      <div className="hidden flex items-center gap-2 mb-6">
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
          <span className="ml-2 text-sm text-emerald-600">Staples</span>
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
        {/* Mobile layout - stacked */}
        <div className="md:hidden space-y-3">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Item name (e.g., paper towels)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base min-h-[44px]"
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
          <div className="flex gap-3">
            <select
              value={newItemDepartment}
              onChange={(e) => setNewItemDepartment(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base min-h-[44px]"
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
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              Add
            </button>
          </div>
        </div>
        {/* Desktop layout - inline */}
        <div className="hidden md:flex gap-3">
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

      {/* Grocery items grouped by store and department */}
      <div className="space-y-4">
        {Array.from(groceryItemsByStoreAndDept.entries()).map(([store, deptMap]) => {
          const allStoreItems = Array.from(deptMap.values()).flat();

          return (
            <div key={store} className="bg-white rounded-xl shadow-sm">
              {/* Store Header - Sticky */}
              <div className="px-4 py-3 border-b border-l-4 border-l-sky-500 flex items-center justify-between bg-sky-100 sticky top-0 z-20 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h3 className="font-semibold text-sky-900">{store}</h3>
                </div>
                <span className="text-sm font-medium text-sky-700">
                  {allStoreItems.length} {allStoreItems.length === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Departments within Store */}
              {Array.from(deptMap.entries()).map(([dept, items]) => (
                <div key={dept}>
                  {/* Department Header - Sticky below store header */}
                  <div className="px-4 py-2 border-b border-l-4 border-l-amber-400 flex items-center justify-between bg-amber-50 sticky top-[48px] z-10">
                    <span className="text-sm font-medium text-gray-700">{dept}</span>
                    <span className="text-xs font-medium text-gray-500">{items.length}</span>
                  </div>

                  {/* Mobile card layout */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {items.map((item) => (
                      <div key={item.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">
                              {item.ingredientName}
                              {item.isStaple && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">
                                  Staple
                                </span>
                              )}
                              {item.isManualAdd && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                                  Added
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {item.totalQuantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </div>
                            {item.recipeBreakdown.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                For: {item.recipeBreakdown.map(b => b.recipeName).join(", ")}
                              </div>
                            )}
                            {stores.length > 0 && (
                              <div className="mt-3">
                                <select
                                  value={item.storeId || ""}
                                  onChange={(e) => handleStoreChange(item.id, e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white min-h-[44px]"
                                >
                                  <option value="">No store</option>
                                  {stores.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => wizard.removeGroceryItem(item.id)}
                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove item"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table rows */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item) => {
                          const isEditing = editingItem?.id === item.id;

                          return (
                            <tr key={item.id} className="hover:bg-gray-50">
                              {/* Ingredient name */}
                              <td className="px-4 py-3 w-1/4">
                                {isEditing && editingItem.field === "name" ? (
                                  <input
                                    type="text"
                                    value={editingItem.value}
                                    onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
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
                                    {item.isStaple && (
                                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">Staple</span>
                                    )}
                                    {item.isManualAdd && (
                                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">Added</span>
                                    )}
                                  </span>
                                )}
                              </td>

                              {/* Amount */}
                              <td className="px-4 py-3 w-24">
                                {isEditing && editingItem.field === "quantity" ? (
                                  <input
                                    type="text"
                                    value={editingItem.value}
                                    onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
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
                                    {item.totalQuantity}{item.unit ? ` ${item.unit}` : ""}
                                  </span>
                                )}
                              </td>

                              {/* Recipes */}
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-600">
                                  {item.recipeBreakdown.length > 0 ? (
                                    item.recipeBreakdown.map((breakdown, idx) => (
                                      <span key={idx}>{idx > 0 && ", "}{breakdown.recipeName}</span>
                                    ))
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              </td>

                              {/* Store */}
                              <td className="px-4 py-3 w-40">
                                <select
                                  value={item.storeId || ""}
                                  onChange={(e) => handleStoreChange(item.id, e.target.value)}
                                  className="text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                                >
                                  <option value="">No store</option>
                                  {stores.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Remove */}
                              <td className="px-4 py-3 text-center w-16">
                                <button
                                  onClick={() => wizard.removeGroceryItem(item.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Remove item"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
              ))}
            </div>
          );
        })}
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

      {/* Error message */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Action buttons - sticky on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-safe md:relative md:border-0 md:p-0 md:mt-8 z-20">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <Link
            href="/weekly-plans/create/events"
            className="px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            <span>&larr;</span>
            Back
          </Link>
          <button
            onClick={handleFinalize}
            disabled={isSubmitting}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                Finalize Plan
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
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
