"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PageHeaderSkeleton, CardSkeleton } from "@/components/Skeleton";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";

interface Store {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

interface DeleteConfirm {
  id: string;
  name: string;
}

export default function StoresPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newStoreName, setNewStoreName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isReordering, setIsReordering] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (session) {
      fetchStores();
    }
  }, [session]);

  const fetchStores = async () => {
    try {
      const response = await fetch("/api/stores");
      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
      }
    } catch (error) {
      console.error("Failed to fetch stores:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;

    setIsAdding(true);
    try {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStoreName.trim(),
          sort_order: stores.length,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStores([...stores, data.store]);
        setNewStoreName("");
        showToast(`Added "${data.store.name}"`);
      } else {
        showToast("Failed to add store", "error");
      }
    } catch (error) {
      console.error("Failed to add store:", error);
      showToast("Failed to add store", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (store: Store) => {
    setEditingId(store.id);
    setEditingName(store.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) {
      handleCancelEdit();
      return;
    }

    try {
      const response = await fetch(`/api/stores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setStores((prev) =>
          prev.map((s) => (s.id === id ? data.store : s))
        );
      }
    } catch (error) {
      console.error("Failed to update store:", error);
    } finally {
      handleCancelEdit();
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/stores/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setStores((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
        showToast(`Deleted "${deleteConfirm.name}"`);
        setDeleteConfirm(null);
      } else {
        const error = await response.json();
        showToast(error.error || "Failed to delete store", "error");
      }
    } catch (error) {
      console.error("Failed to delete store:", error);
      showToast("Failed to delete store", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveStore = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stores.length) return;

    setIsReordering(true);

    // Swap stores in local state
    const newStores = [...stores];
    [newStores[index], newStores[targetIndex]] = [newStores[targetIndex], newStores[index]];
    setStores(newStores);

    // Update sort_order for both stores
    try {
      await Promise.all([
        fetch(`/api/stores/${newStores[index].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: index }),
        }),
        fetch(`/api/stores/${newStores[targetIndex].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: targetIndex }),
        }),
      ]);
    } catch (error) {
      console.error("Failed to reorder stores:", error);
      // Revert on error
      fetchStores();
    } finally {
      setIsReordering(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view stores.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeaderSkeleton />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
        <span className="text-sm text-gray-500">{stores.length} stores</span>
      </div>

      {/* Add Store */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            placeholder="Add a new store..."
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
            onKeyDown={(e) => e.key === "Enter" && handleAddStore()}
          />
          <button
            onClick={handleAddStore}
            disabled={isAdding || !newStoreName.trim()}
            className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium whitespace-nowrap"
          >
            {isAdding ? "Adding..." : "Add Store"}
          </button>
        </div>
      </div>

      {/* Store List */}
      {stores.length === 0 ? (
        <EmptyState
          icon="stores"
          title="No stores yet"
          description="Add stores to organize your grocery shopping by location."
        />
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {stores.map((store, index) => (
              <div key={store.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Reorder buttons - 44px touch targets */}
                  <div className="flex flex-col -ml-2">
                    <button
                      onClick={() => handleMoveStore(index, "up")}
                      disabled={index === 0 || isReordering}
                      className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveStore(index, "down")}
                      disabled={index === stores.length - 1 || isReordering}
                      className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 w-6">{index + 1}.</span>
                      {editingId === store.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(store.id);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          onBlur={() => handleSaveEdit(store.id)}
                          autoFocus
                          className="flex-1 px-2 py-1 border border-emerald-500 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                        />
                      ) : (
                        <Link
                          href={`/stores/${store.id}`}
                          className="text-emerald-600 font-medium text-left truncate hover:underline"
                        >
                          {store.name}
                        </Link>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 ml-8">
                      Added {new Date(store.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-1 -mr-2">
                    <button
                      onClick={() => handleStartEdit(store)}
                      className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-lg transition-colors"
                      title="Edit name"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(store.id, store.name)}
                      className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:text-red-700 active:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-16">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-32">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stores.map((store, index) => (
                  <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      {editingId === store.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(store.id);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          onBlur={() => handleSaveEdit(store.id)}
                          autoFocus
                          className="w-full px-2 py-1 border border-emerald-500 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      ) : (
                        <Link
                          href={`/stores/${store.id}`}
                          className="text-emerald-600 hover:text-emerald-700 font-medium text-left hover:underline"
                        >
                          {store.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(store.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleMoveStore(index, "up")}
                          disabled={index === 0 || isReordering}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveStore(index, "down")}
                          disabled={index === stores.length - 1 || isReordering}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div className="w-px bg-gray-200 mx-1"></div>
                        <button
                          onClick={() => handleStartEdit(store)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="Edit name"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(store.id, store.name)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Delete store"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete "${deleteConfirm?.name}"?`}
        message="Any ingredients assigned to this store will have their store cleared."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
