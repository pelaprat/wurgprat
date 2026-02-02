"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { useToast } from "@/components/Toast";

interface QueueItem {
  id: string;
  recipe_id: string;
  notes: string | null;
  created_at: string;
  user_id: string;
  recipes: {
    id: string;
    name: string;
    cuisine: string | null;
    time_rating: number | null;
    source_url: string | null;
  };
  users: {
    id: string;
    name: string;
  };
}

export default function QueuePage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchQueue();
    }
  }, [session]);

  const fetchQueue = async () => {
    try {
      const response = await fetch("/api/recipe-queue");
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
        setCurrentUserId(data.currentUserId || null);
      }
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditNotes = (item: QueueItem) => {
    setEditingId(item.id);
    setEditNotes(item.notes || "");
  };

  const handleSaveNotes = async (id: string) => {
    setSavingNotes(true);
    try {
      const response = await fetch(`/api/recipe-queue/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: editNotes }),
      });
      if (response.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, notes: editNotes || null } : item
          )
        );
        setEditingId(null);
        showToast("Notes updated");
      } else {
        showToast("Failed to update notes", "error");
      }
    } catch (error) {
      console.error("Failed to update notes:", error);
      showToast("Failed to update notes", "error");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/recipe-queue/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        showToast("Removed from queue");
      } else {
        showToast("Failed to remove item", "error");
      }
    } catch (error) {
      console.error("Failed to delete queue item:", error);
      showToast("Failed to remove item", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const isStale = (createdAt: string) => {
    return differenceInDays(new Date(), new Date(createdAt)) >= 30;
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view the queue.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="skeleton h-8 w-48 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-4">
              <div className="skeleton h-5 w-48 rounded mb-2" />
              <div className="skeleton h-4 w-32 rounded mb-1" />
              <div className="skeleton h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipe Queue</h1>
        <span className="text-sm text-gray-500">
          {items.length} {items.length === 1 ? "recipe" : "recipes"} queued
        </span>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 text-center">
          <p className="text-gray-500 mb-3">
            Your queue is empty. Browse recipes to add some.
          </p>
          <Link
            href="/recipes"
            className="inline-flex justify-center px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            Browse Recipes
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const stale = isStale(item.created_at);
            const isOwner = currentUserId === item.user_id;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-sm p-4 ${
                  stale ? "border border-amber-200" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Recipe name */}
                    <Link
                      href={`/recipes/${item.recipes.id}`}
                      className="text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      {item.recipes.name}
                    </Link>

                    {/* Meta info */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                      <span>Added by {item.users.name}</span>
                      <span
                        className={stale ? "text-amber-600 font-medium" : ""}
                      >
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                        })}
                        {stale && " (stale)"}
                      </span>
                      {item.recipes.cuisine && (
                        <span className="text-gray-400">
                          {item.recipes.cuisine}
                        </span>
                      )}
                    </div>

                    {/* Notes display or edit */}
                    {editingId === item.id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Add a note..."
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveNotes(item.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveNotes(item.id)}
                          disabled={savingNotes}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      item.notes && (
                        <p className="mt-1.5 text-sm text-gray-600 italic">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )
                    )}
                  </div>

                  {/* Actions */}
                  {isOwner && editingId !== item.id && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEditNotes(item)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit notes"
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove from queue"
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
