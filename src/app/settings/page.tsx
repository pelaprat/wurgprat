"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface SheetResult {
  url: string;
  status: "active" | "wishlist";
  success: boolean;
  error?: string;
  rowCount: number;
  headersFound: string[];
  recipesFound: number;
  recipesImported: number;
  recipesSkipped: number;
  skippedReasons: string[];
}

interface ImportResult {
  imported: number;
  sheets: SheetResult[];
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [cookedRecipesUrl, setCookedRecipesUrl] = useState("");
  const [wishlistRecipesUrl, setWishlistRecipesUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [importMessage, setImportMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (session) {
      fetchSettings();
    }
  }, [session]);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setCookedRecipesUrl(data.settings?.cooked_recipes_sheet_url || "");
        setWishlistRecipesUrl(data.settings?.wishlist_recipes_sheet_url || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cooked_recipes_sheet_url: cookedRecipesUrl,
          wishlist_recipes_sheet_url: wishlistRecipesUrl,
        }),
      });

      if (response.ok) {
        setSaveMessage({ type: "success", text: "Settings saved successfully!" });
      } else {
        const data = await response.json();
        setSaveMessage({
          type: "error",
          text: data.error || "Failed to save settings.",
        });
      }
    } catch {
      setSaveMessage({
        type: "error",
        text: "Failed to save settings. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportRecipes = async () => {
    if (!cookedRecipesUrl && !wishlistRecipesUrl) {
      setImportMessage({
        type: "error",
        text: "Please enter at least one Google Sheet URL first.",
      });
      return;
    }

    setIsImporting(true);
    setImportMessage({ type: "info", text: "Importing recipes... This may take a few minutes." });
    setImportResult(null);

    try {
      const response = await fetch("/api/recipes/import", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data);
        if (data.imported > 0) {
          setImportMessage({
            type: "success",
            text: `Successfully imported ${data.imported} recipes!`,
          });
        } else {
          setImportMessage({
            type: "info",
            text: "Import completed. See details below.",
          });
        }
      } else {
        setImportMessage({
          type: "error",
          text: data.error || "Failed to import recipes.",
        });
      }
    } catch {
      setImportMessage({
        type: "error",
        text: "Failed to import recipes. Please try again.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view settings.</p>
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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recipe Google Sheets
        </h2>
        <p className="text-gray-600 mb-6">
          Connect your Google Sheets to import recipes. You can have separate
          sheets for recipes you&apos;ve already cooked and recipes you want to
          try.
        </p>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="cooked-recipes-url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Cooked Recipes Sheet URL
            </label>
            <input
              type="url"
              id="cooked-recipes-url"
              value={cookedRecipesUrl}
              onChange={(e) => setCookedRecipesUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Recipes you and your household have already made.
            </p>
          </div>

          <div>
            <label
              htmlFor="wishlist-recipes-url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Wishlist Recipes Sheet URL
            </label>
            <input
              type="url"
              id="wishlist-recipes-url"
              value={wishlistRecipesUrl}
              onChange={(e) => setWishlistRecipesUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Recipes you want to try in the future.
            </p>
          </div>
        </div>

        {saveMessage && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              saveMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Import Recipes
        </h2>
        <p className="text-gray-600 mb-6">
          Import recipes from your Google Sheets. This will read the sheets,
          fetch each recipe URL to extract ingredients, and save everything to
          your recipe library.
        </p>

        {importMessage && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              importMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800"
                : importMessage.type === "error"
                ? "bg-red-50 text-red-800"
                : "bg-blue-50 text-blue-800"
            }`}
          >
            {importMessage.text}
          </div>
        )}

        <button
          onClick={handleImportRecipes}
          disabled={isImporting || (!cookedRecipesUrl && !wishlistRecipesUrl)}
          className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
        >
          {isImporting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Importing...
            </>
          ) : (
            "Import Recipes"
          )}
        </button>

        {importResult && importResult.sheets.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-md font-semibold text-gray-800">Import Details</h3>
            {importResult.sheets.map((sheet, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  sheet.success ? "border-gray-200 bg-gray-50" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">
                    {sheet.status === "active" ? "Cooked Recipes" : "Wishlist Recipes"}
                  </span>
                  {sheet.success ? (
                    <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded">
                      Sheet found
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                      Error
                    </span>
                  )}
                </div>

                {sheet.error && (
                  <p className="text-sm text-red-700 mb-2">{sheet.error}</p>
                )}

                <div className="text-sm text-gray-600 space-y-1">
                  <p>Rows in sheet: {sheet.rowCount}</p>
                  {sheet.headersFound.length > 0 && (
                    <p>Headers found: {sheet.headersFound.join(", ")}</p>
                  )}
                  <p>Recipes found: {sheet.recipesFound}</p>
                  <p>Recipes imported: {sheet.recipesImported}</p>
                  <p>Recipes skipped: {sheet.recipesSkipped}</p>
                </div>

                {sheet.skippedReasons.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                      View skip reasons ({sheet.skippedReasons.length})
                    </summary>
                    <ul className="mt-2 text-sm text-gray-600 space-y-1 ml-4 list-disc">
                      {sheet.skippedReasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
