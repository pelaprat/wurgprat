"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PageHeaderSkeleton, CardSkeleton } from "@/components/Skeleton";

interface Store {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export default function StoresPage() {
  const { data: session } = useSession();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newStoreName, setNewStoreName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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
      }
    } catch (error) {
      console.error("Failed to add store:", error);
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Any ingredients assigned to this store will have their store cleared.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/stores/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setStores((prev) => prev.filter((s) => s.id !== id));
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete store");
      }
    } catch (error) {
      console.error("Failed to delete store:", error);
      alert("Failed to delete store");
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
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 text-center text-gray-500">
          No stores yet. Add your first store above.
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {stores.map((store, index) => (
              <div key={store.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
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
                        <button
                          onClick={() => handleStartEdit(store)}
                          className="text-emerald-600 font-medium text-left truncate"
                        >
                          {store.name}
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 ml-8">
                      Added {new Date(store.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(store.id, store.name)}
                    className="px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-sm transition-colors"
                  >
                    Delete
                  </button>
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
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-24">
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
                        <button
                          onClick={() => handleStartEdit(store)}
                          className="text-emerald-600 hover:text-emerald-700 font-medium text-left hover:underline"
                        >
                          {store.name}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(store.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(store.id, store.name)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Delete store"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
