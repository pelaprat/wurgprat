import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { readGoogleSheet, extractSpreadsheetId, extractGid } from "@/lib/google";
import Anthropic from "@anthropic-ai/sdk";

interface SheetRow {
  name: string;
  ratingEmily: number | null;
  ratingEtienne: number | null;
  costRating: number | null;
  timeRating: number | null;
  source: string | null;
  sourceUrl: string | null;
}

interface ExtractedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

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

// Parse a row from the Google Sheet
function parseSheetRow(row: string[], headers: string[]): SheetRow | null {
  const getCol = (name: string) => {
    const idx = headers.findIndex(
      (h) => h.toLowerCase().includes(name.toLowerCase())
    );
    return idx >= 0 ? row[idx] : null;
  };

  const name = getCol("recipe name");
  if (!name) return null;

  const parseRating = (val: string | null): number | null => {
    if (!val) return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  return {
    name,
    ratingEmily: parseRating(getCol("emily")),
    ratingEtienne: parseRating(getCol("etienne")),
    costRating: parseRating(getCol("cost")),
    timeRating: parseRating(getCol("time")),
    source: getCol("recipe source"),
    sourceUrl: getCol("recipe url"),
  };
}

// Fetch a webpage and extract its text content
async function fetchWebPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MealPlannerBot/1.0; +https://mealplanner.app)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // Basic HTML to text conversion - remove scripts, styles, and tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to first 10000 chars to avoid token limits
    return text.slice(0, 10000);
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return "";
  }
}

// Use Claude to extract ingredients from recipe page content
async function extractIngredients(
  recipeName: string,
  pageContent: string
): Promise<ExtractedIngredient[]> {
  if (!pageContent) return [];

  const anthropic = new Anthropic();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract the ingredients from this recipe page for "${recipeName}".

Return a JSON array of ingredients with this structure:
[{"name": "ingredient name", "quantity": 2, "unit": "cups", "notes": "diced"}]

- "name" should be the base ingredient (e.g., "chicken breast", "olive oil")
- "quantity" should be a number or null if not specified
- "unit" should be the unit of measure (e.g., "cups", "tbsp", "lbs") or null
- "notes" should include preparation notes like "diced", "room temperature" or null

Only return the JSON array, no other text.

Page content:
${pageContent}`,
      },
    ],
  });

  try {
    const content = message.content[0];
    if (content.type !== "text") return [];

    const parsed = JSON.parse(content.text);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: Record<string, unknown>) => ({
      name: String(item.name || ""),
      quantity:
        typeof item.quantity === "number" ? item.quantity : null,
      unit: typeof item.unit === "string" ? item.unit : null,
      notes: typeof item.notes === "string" ? item.notes : null,
    }));
  } catch (error) {
    console.error("Failed to parse ingredients:", error);
    return [];
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user's household
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Get household settings
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  if (householdError) {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }

  const settings = household.settings || {};
  const sheetConfigs: { url: string; status: "active" | "wishlist" }[] = [
    { url: settings.cooked_recipes_sheet_url, status: "active" as const },
    { url: settings.wishlist_recipes_sheet_url, status: "wishlist" as const },
  ].filter((s): s is { url: string; status: "active" | "wishlist" } => Boolean(s.url));

  if (sheetConfigs.length === 0) {
    return NextResponse.json(
      { error: "No Google Sheet URLs configured" },
      { status: 400 }
    );
  }

  let totalImported = 0;
  const sheetResults: SheetResult[] = [];

  for (const { url, status } of sheetConfigs) {
    const result: SheetResult = {
      url,
      status,
      success: false,
      rowCount: 0,
      headersFound: [],
      recipesFound: 0,
      recipesImported: 0,
      recipesSkipped: 0,
      skippedReasons: [],
    };

    const spreadsheetId = extractSpreadsheetId(url);
    if (!spreadsheetId) {
      result.error = "Could not extract spreadsheet ID from URL";
      sheetResults.push(result);
      continue;
    }

    // Extract gid (sheet tab ID) from URL to read the correct tab
    const gid = extractGid(url);

    try {
      // Read the sheet (passing gid to read from specific tab)
      const rows = await readGoogleSheet(
        session.accessToken,
        spreadsheetId,
        "A:Z",
        gid
      );

      result.rowCount = rows.length;

      if (rows.length === 0) {
        result.error = "Sheet is empty";
        sheetResults.push(result);
        continue;
      }

      if (rows.length === 1) {
        result.error = "Sheet only has headers, no data rows";
        result.headersFound = rows[0];
        sheetResults.push(result);
        continue;
      }

      const headers = rows[0].map((h: string) => String(h).toLowerCase().trim());
      result.headersFound = rows[0];
      result.success = true;

      // Check for required "recipe name" column
      const nameColIdx = headers.findIndex((h: string) => h.includes("recipe") && h.includes("name"));
      if (nameColIdx === -1) {
        result.error = `Could not find "Recipe name" column. Found columns: ${rows[0].join(", ")}`;
        sheetResults.push(result);
        continue;
      }

      // Process each recipe row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) {
          result.skippedReasons.push(`Row ${i + 1}: Empty row`);
          result.recipesSkipped++;
          continue;
        }

        const recipe = parseSheetRow(row, headers);
        if (!recipe) {
          result.skippedReasons.push(`Row ${i + 1}: Could not parse row`);
          result.recipesSkipped++;
          continue;
        }

        if (!recipe.name || !recipe.name.trim()) {
          result.skippedReasons.push(`Row ${i + 1}: No recipe name`);
          result.recipesSkipped++;
          continue;
        }

        result.recipesFound++;

        // Check if recipe already exists
        const { data: existing } = await supabase
          .from("recipes")
          .select("id")
          .eq("household_id", user.household_id)
          .eq("name", recipe.name)
          .single();

        if (existing) {
          result.skippedReasons.push(`Row ${i + 1}: "${recipe.name}" already exists`);
          result.recipesSkipped++;
          continue;
        }

        // Fetch ingredients from recipe URL
        let ingredients: ExtractedIngredient[] = [];
        if (recipe.sourceUrl) {
          try {
            const pageContent = await fetchWebPage(recipe.sourceUrl);
            if (pageContent) {
              ingredients = await extractIngredients(recipe.name, pageContent);
            }
          } catch (err) {
            console.error(`Failed to extract ingredients for ${recipe.name}:`, err);
          }
        }

        // Insert the recipe
        const { data: newRecipe, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            household_id: user.household_id,
            google_sheet_id: spreadsheetId,
            name: recipe.name,
            source: recipe.source,
            source_url: recipe.sourceUrl,
            cost_rating: recipe.costRating,
            time_rating: recipe.timeRating,
            rating_emily: recipe.ratingEmily,
            rating_etienne: recipe.ratingEtienne,
            status,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (recipeError || !newRecipe) {
          result.skippedReasons.push(`Row ${i + 1}: "${recipe.name}" failed to insert: ${recipeError?.message}`);
          result.recipesSkipped++;
          continue;
        }

        // Insert ingredients
        for (let j = 0; j < ingredients.length; j++) {
          const ing = ingredients[j];
          if (!ing.name) continue;

          // Find or create ingredient
          let { data: ingredient } = await supabase
            .from("ingredients")
            .select("id")
            .eq("household_id", user.household_id)
            .eq("name", ing.name.toLowerCase())
            .single();

          if (!ingredient) {
            const { data: newIng } = await supabase
              .from("ingredients")
              .insert({
                household_id: user.household_id,
                name: ing.name.toLowerCase(),
              })
              .select("id")
              .single();
            ingredient = newIng;
          }

          if (ingredient) {
            await supabase.from("recipe_ingredients").insert({
              recipe_id: newRecipe.id,
              ingredient_id: ingredient.id,
              quantity: ing.quantity,
              unit: ing.unit,
              notes: ing.notes,
              sort_order: j,
            });
          }
        }

        result.recipesImported++;
        totalImported++;
      }
    } catch (error) {
      result.error = `Failed to read sheet: ${error instanceof Error ? error.message : String(error)}`;
    }

    sheetResults.push(result);
  }

  return NextResponse.json({
    imported: totalImported,
    sheets: sheetResults,
  });
}
