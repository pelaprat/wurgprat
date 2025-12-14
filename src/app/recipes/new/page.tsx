"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DebugStep {
  step: string;
  status: "pending" | "running" | "success" | "error";
  details?: string;
  data?: unknown;
}

interface ExtractedRecipe {
  name: string;
  description: string;
  category: string;
  cuisine: string;
  ingredients: {
    name: string;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
  }[];
}

interface CreateRecipeResponse {
  success: boolean;
  recipe?: {
    id: string;
    name: string;
  };
  debug: {
    urlFetched: string;
    contentLength: number;
    contentPreview: string;
    aiExtraction: ExtractedRecipe;
    ingredientsCreated: number;
  };
  error?: string;
}

export default function NewRecipePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([]);
  const [result, setResult] = useState<CreateRecipeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateStep = (stepName: string, updates: Partial<DebugStep>) => {
    setDebugSteps((prev) =>
      prev.map((s) => (s.step === stepName ? { ...s, ...updates } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setDebugSteps([
      { step: "Validating URL", status: "running" },
      { step: "Fetching web page", status: "pending" },
      { step: "Extracting recipe data with AI", status: "pending" },
      { step: "Creating recipe in database", status: "pending" },
      { step: "Creating ingredients", status: "pending" },
    ]);

    try {
      // Validate URL format
      try {
        new URL(url);
        updateStep("Validating URL", { status: "success", details: "Valid URL format" });
      } catch {
        updateStep("Validating URL", { status: "error", details: "Invalid URL format" });
        setError("Please enter a valid URL");
        setIsLoading(false);
        return;
      }

      updateStep("Fetching web page", { status: "running" });

      const response = await fetch("/api/recipes/create-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data: CreateRecipeResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create recipe");
      }

      // Update all steps based on response
      updateStep("Fetching web page", {
        status: "success",
        details: `Fetched ${data.debug.contentLength} characters`,
        data: data.debug.contentPreview,
      });

      updateStep("Extracting recipe data with AI", {
        status: "success",
        details: `Extracted: ${data.debug.aiExtraction.name}`,
        data: {
          name: data.debug.aiExtraction.name,
          description: data.debug.aiExtraction.description,
          category: data.debug.aiExtraction.category,
          cuisine: data.debug.aiExtraction.cuisine,
          ingredientCount: data.debug.aiExtraction.ingredients.length,
        },
      });

      updateStep("Creating recipe in database", {
        status: "success",
        details: `Recipe ID: ${data.recipe?.id}`,
      });

      updateStep("Creating ingredients", {
        status: "success",
        details: `Created ${data.debug.ingredientsCreated} ingredients`,
        data: data.debug.aiExtraction.ingredients,
      });

      setResult(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);

      // Mark remaining pending/running steps as error
      setDebugSteps((prev) =>
        prev.map((s) =>
          s.status === "pending" || s.status === "running"
            ? { ...s, status: "error", details: errorMsg }
            : s
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to add recipes.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/recipes"
          className="text-emerald-600 hover:text-emerald-700 text-sm"
        >
          &larr; Back to Recipes
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New Recipe</h1>

      {/* URL Input Form */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Recipe URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/recipe/..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              disabled={isLoading}
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              Enter the URL of a recipe page. We&apos;ll automatically extract the
              recipe name, description, category, cuisine, and ingredients.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating Recipe..." : "Create Recipe"}
          </button>
        </form>
      </div>

      {/* Debug Steps */}
      {debugSteps.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Processing Steps
          </h2>
          <div className="space-y-4">
            {debugSteps.map((step, index) => (
              <div key={index} className="border-l-4 pl-4 py-2" style={{
                borderColor:
                  step.status === "success"
                    ? "#10b981"
                    : step.status === "error"
                    ? "#ef4444"
                    : step.status === "running"
                    ? "#3b82f6"
                    : "#d1d5db",
              }}>
                <div className="flex items-center gap-2">
                  {step.status === "running" && (
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  )}
                  {step.status === "success" && (
                    <span className="text-emerald-500">&#10003;</span>
                  )}
                  {step.status === "error" && (
                    <span className="text-red-500">&#10007;</span>
                  )}
                  {step.status === "pending" && (
                    <span className="text-gray-400">&#8226;</span>
                  )}
                  <span
                    className={`font-medium ${
                      step.status === "error"
                        ? "text-red-700"
                        : step.status === "success"
                        ? "text-emerald-700"
                        : "text-gray-700"
                    }`}
                  >
                    {step.step}
                  </span>
                </div>
                {step.details && (
                  <p className="text-sm text-gray-600 mt-1">{step.details}</p>
                )}
                {step.data !== undefined && step.data !== null && (
                  <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
                    {typeof step.data === "string"
                      ? step.data
                      : JSON.stringify(step.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Success Result */}
      {result?.success && result.recipe && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-emerald-800 mb-4">
            Recipe Created Successfully!
          </h2>
          <p className="text-emerald-700 mb-4">
            <strong>{result.recipe.name}</strong> has been added to your recipes.
          </p>
          <div className="flex gap-4">
            <Link
              href={`/recipes/${result.recipe.id}`}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              View Recipe
            </Link>
            <button
              onClick={() => {
                setUrl("");
                setDebugSteps([]);
                setResult(null);
              }}
              className="px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              Add Another Recipe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
