"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

interface Ingredient {
  id: string;
  name: string;
  department?: string;
}

interface Store {
  id: string;
  name: string;
  sort_order: number;
  department_order?: string[] | null;
  created_at: string;
  ingredients: Ingredient[];
}

interface Department {
  id: string;
  name: string;
  sort_order: number;
}

export default function StoreDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentOrder, setDepartmentOrder] = useState<string[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!params.id) return;

      try {
        // Fetch store and departments in parallel
        const [storeRes, deptRes] = await Promise.all([
          fetch(`/api/stores/${params.id}`),
          fetch("/api/departments"),
        ]);

        if (storeRes.ok) {
          const storeData = await storeRes.json();
          setStore(storeData.store);

          // Initialize department order from store's custom order or default from DB
          if (deptRes.ok) {
            const deptData = await deptRes.json();
            const defaultOrder = (deptData.departments || []).map((d: Department) => d.name);
            setDepartmentOrder(storeData.store.department_order || defaultOrder);
          }
        } else {
          setError("Store not found");
        }
      } catch {
        setError("Failed to load store");
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchData();
    }
  }, [session, params.id]);

  const moveDepartment = async (index: number, direction: "up" | "down") => {
    const newOrder = [...departmentOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setDepartmentOrder(newOrder);
    setOrderMessage(null);

    // Auto-save the new order
    setIsSavingOrder(true);
    try {
      const response = await fetch(`/api/stores/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_order: newOrder }),
      });

      if (response.ok) {
        const data = await response.json();
        setStore((prev) => prev ? { ...prev, department_order: data.store.department_order } : null);
      } else {
        setOrderMessage({ type: "error", text: "Failed to save order" });
      }
    } catch {
      setOrderMessage({ type: "error", text: "Failed to save order" });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/stores/${params.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        showToast(`Deleted "${store?.name}"`);
        router.push("/stores");
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to delete store", "error");
      }
    } catch {
      showToast("Failed to delete store", "error");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Group ingredients by department
  const ingredientsByDepartment = useMemo(() => {
    if (!store?.ingredients) return null;
    return store.ingredients.reduce(
      (acc, ingredient) => {
        const dept = ingredient.department || "Uncategorized";
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(ingredient);
        return acc;
      },
      {} as Record<string, Ingredient[]>
    );
  }, [store?.ingredients]);

  // Sort departments based on departmentOrder
  const sortedDepartments = useMemo(() => {
    if (!ingredientsByDepartment) return [];
    return Object.entries(ingredientsByDepartment).sort(([a], [b]) => {
      const indexA = departmentOrder.indexOf(a);
      const indexB = departmentOrder.indexOf(b);
      // Departments not in order go to the end, sorted alphabetically
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [ingredientsByDepartment, departmentOrder]);

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view this store.</p>
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

  if (error || !store) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">{error || "Store not found"}</p>
          <Link
            href="/stores"
            className="text-emerald-600 hover:text-emerald-700 mt-4 inline-block"
          >
            Back to stores
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
          href="/stores"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Back to stores
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Department Order - First on mobile, sidebar on desktop */}
        <div className="order-1 md:order-none md:col-start-3 md:row-start-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Department Order</h2>
            <p className="text-sm text-gray-500 mb-4">
              Set the order departments appear when shopping at this store.
            </p>

            {/* Department list */}
            {departmentOrder.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">
                No departments defined yet. Add departments to your ingredients first.
              </p>
            ) : (
              <div className="space-y-1 mb-4">
                {departmentOrder.map((dept, index) => (
                  <div
                    key={dept}
                    className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-xs text-gray-400 w-5">{index + 1}</span>
                    <span className="flex-1 text-sm">{dept}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveDepartment(index, "up")}
                        disabled={index === 0 || isSavingOrder}
                        className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveDepartment(index, "down")}
                        disabled={index === departmentOrder.length - 1 || isSavingOrder}
                        className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Message */}
            {orderMessage && (
              <div className={`text-sm mb-3 ${orderMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                {orderMessage.text}
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Ingredients */}
        <div className="order-2 md:order-none md:col-span-2 md:row-span-3 md:col-start-1 md:row-start-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Ingredients at this store
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({store.ingredients?.length || 0})
              </span>
            </h2>

            {sortedDepartments.length > 0 ? (
              <div className="space-y-6">
                {sortedDepartments.map(([department, ingredients]) => (
                    <div key={department}>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {department}
                      </h3>
                      <ul className="space-y-1">
                        {ingredients
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((ingredient) => (
                            <li key={ingredient.id}>
                              <Link
                                href={`/ingredients/${ingredient.id}`}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                {ingredient.name}
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500">
                No ingredients assigned to this store yet.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="order-3 md:order-none md:col-start-3 md:row-start-2">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Actions</h2>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full px-4 py-3 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              Delete Store
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="order-4 md:order-none md:col-start-3 md:row-start-3 text-xs text-gray-400 px-2">
          <p>Created: {new Date(store.created_at).toLocaleString()}</p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title={`Delete "${store.name}"?`}
        message="This will remove the store and clear it from any ingredients that were assigned to it."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
