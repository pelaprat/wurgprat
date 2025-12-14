"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Ingredient {
  id: string;
  name: string;
  department?: string;
}

interface Store {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  ingredients: Ingredient[];
}

export default function StoreDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStore = async () => {
      if (!params.id) return;

      try {
        const response = await fetch(`/api/stores/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setStore(data.store);
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
      fetchStore();
    }
  }, [session, params.id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this store?")) return;

    try {
      const response = await fetch(`/api/stores/${params.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/stores");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete store");
      }
    } catch {
      alert("Failed to delete store");
    }
  };

  // Group ingredients by department
  const ingredientsByDepartment = store?.ingredients.reduce(
    (acc, ingredient) => {
      const dept = ingredient.department || "Uncategorized";
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(ingredient);
      return acc;
    },
    {} as Record<string, Ingredient[]>
  );

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
        {/* Main Content - Ingredients */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Ingredients at this store
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({store.ingredients?.length || 0})
              </span>
            </h2>

            {ingredientsByDepartment &&
            Object.keys(ingredientsByDepartment).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(ingredientsByDepartment)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([department, ingredients]) => (
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Sort Order:</span>
                <p className="font-medium">{store.sort_order}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Actions</h2>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete Store
            </button>
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-400 px-2">
            <p>Created: {new Date(store.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
