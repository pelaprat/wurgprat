import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderPrompt } from "@/prompts";
import { validateExternalUrl, fetchWithTimeout } from "@/utils/url";

interface ExtractedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

interface ExtractedRecipe {
  name: string;
  description: string;
  category: string;
  cuisine: string;
  ingredients: ExtractedIngredient[];
}

// Fetch a webpage and return raw HTML
async function fetchWebPage(url: string): Promise<string> {
  // Validate URL to prevent SSRF attacks
  const validation = validateExternalUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid URL");
  }

  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WurgpratBot/1.0; +https://wurgprat.app)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  }, 30000);

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

// Try to extract recipe from JSON-LD structured data (schema.org Recipe)
function extractJsonLdRecipe(html: string): ExtractedRecipe | null {
  // Find all JSON-LD script blocks
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const data = JSON.parse(jsonContent);

      // Handle both single objects and arrays (some sites use @graph)
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];

      for (const item of items) {
        if (item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))) {
          console.log("[create-from-url] Found JSON-LD Recipe schema");
          return parseJsonLdRecipe(item);
        }
      }
    } catch {
      // Invalid JSON, continue to next block
      continue;
    }
  }

  return null;
}

// Parse a JSON-LD Recipe object into our format
function parseJsonLdRecipe(recipe: Record<string, unknown>): ExtractedRecipe {
  const ingredients: ExtractedIngredient[] = [];

  // Parse recipeIngredient array
  const recipeIngredients = recipe.recipeIngredient;
  if (Array.isArray(recipeIngredients)) {
    for (const ing of recipeIngredients) {
      if (typeof ing === "string") {
        const parsed = parseIngredientString(ing);
        ingredients.push(parsed);
      }
    }
  }

  // Get description - could be string or object
  let description = "";
  if (typeof recipe.description === "string") {
    description = recipe.description;
  }

  // Get name
  const name = typeof recipe.name === "string" ? recipe.name : "Untitled Recipe";

  // Try to determine cuisine from keywords or recipeCuisine
  let cuisine = "Other";
  if (typeof recipe.recipeCuisine === "string") {
    cuisine = recipe.recipeCuisine;
  } else if (Array.isArray(recipe.recipeCuisine) && recipe.recipeCuisine.length > 0) {
    cuisine = String(recipe.recipeCuisine[0]);
  }

  // Try to determine category from recipeCategory
  let category = "entree";
  if (typeof recipe.recipeCategory === "string") {
    category = recipe.recipeCategory.toLowerCase();
  } else if (Array.isArray(recipe.recipeCategory) && recipe.recipeCategory.length > 0) {
    category = String(recipe.recipeCategory[0]).toLowerCase();
  }

  return {
    name,
    description,
    category: normalizeCategory(category),
    cuisine,
    ingredients,
  };
}

// Parse an ingredient string like "2 cups flour, sifted" into components
function parseIngredientString(str: string): ExtractedIngredient {
  const trimmed = str.trim();

  // Common patterns: "2 cups flour", "1/2 tsp salt", "3 large eggs"
  // Try to extract quantity, unit, and name
  const quantityPattern = /^([\d./\s]+(?:\s*-\s*[\d./]+)?)\s*/;
  const unitPattern = /^(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|quarts?|pints?|gallons?|cloves?|pieces?|slices?|cans?|packages?|bunch(?:es)?|heads?|stalks?|sprigs?|pinch(?:es)?|dash(?:es)?|large|medium|small)\s+/i;

  let remaining = trimmed;
  let quantity: number | null = null;
  let unit: string | null = null;

  // Extract quantity
  const qMatch = remaining.match(quantityPattern);
  if (qMatch) {
    const qStr = qMatch[1].trim();
    // Handle fractions like "1/2" or "1 1/2"
    quantity = parseFraction(qStr);
    remaining = remaining.slice(qMatch[0].length);
  }

  // Extract unit
  const uMatch = remaining.match(unitPattern);
  if (uMatch) {
    unit = uMatch[1].toLowerCase();
    remaining = remaining.slice(uMatch[0].length);
  }

  // The rest is the ingredient name, possibly with notes in parentheses
  let name = remaining;
  let notes: string | null = null;

  // Extract notes from parentheses
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) {
    notes = parenMatch[1].trim();
    name = name.replace(/\([^)]+\)/, "").trim();
  }

  // Also check for comma-separated notes like "flour, sifted"
  const commaIndex = name.indexOf(",");
  if (commaIndex > 0) {
    const possibleNotes = name.slice(commaIndex + 1).trim();
    name = name.slice(0, commaIndex).trim();
    notes = notes ? `${notes}, ${possibleNotes}` : possibleNotes;
  }

  return {
    name: name || trimmed,
    quantity,
    unit,
    notes,
  };
}

// Parse fraction strings like "1/2", "1 1/2", "2"
function parseFraction(str: string): number | null {
  const parts = str.trim().split(/\s+/);
  let total = 0;

  for (const part of parts) {
    if (part.includes("/")) {
      const [num, denom] = part.split("/");
      const n = parseFloat(num);
      const d = parseFloat(denom);
      if (!isNaN(n) && !isNaN(d) && d !== 0) {
        total += n / d;
      }
    } else {
      const n = parseFloat(part);
      if (!isNaN(n)) {
        total += n;
      }
    }
  }

  return total > 0 ? total : null;
}

// Clean HTML by removing noise (comments, sidebars, etc.) before text extraction
function cleanHtmlForExtraction(html: string): string {
  let cleaned = html;

  // Remove script and style tags
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Remove comment sections (common patterns)
  // Match elements with id/class containing "comment"
  cleaned = cleaned.replace(/<(?:div|section|aside|footer)[^>]*(?:id|class)=["'][^"']*comment[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|aside|footer)>/gi, "");
  cleaned = cleaned.replace(/<(?:div|section|aside|footer)[^>]*(?:id|class)=["'][^"']*review[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|aside|footer)>/gi, "");
  cleaned = cleaned.replace(/<(?:div|section|aside|footer)[^>]*(?:id|class)=["'][^"']*respond[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|aside|footer)>/gi, "");

  // Remove sidebars and related content
  cleaned = cleaned.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");
  cleaned = cleaned.replace(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*sidebar[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section)>/gi, "");
  cleaned = cleaned.replace(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*related[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section)>/gi, "");
  cleaned = cleaned.replace(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*recommended[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section)>/gi, "");

  // Remove footer
  cleaned = cleaned.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

  // Remove nav
  cleaned = cleaned.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");

  // Remove header (but keep h1, h2, etc.)
  cleaned = cleaned.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

  // Remove ad sections
  cleaned = cleaned.replace(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*(?:ad-|ads-|advert|sponsor|promo)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section)>/gi, "");

  // Remove social sharing sections
  cleaned = cleaned.replace(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*(?:share|social)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section)>/gi, "");

  // Now convert to text
  const text = cleaned
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

// Use Gemini to extract recipe details from page content
async function extractRecipeWithAI(
  pageContent: string,
  url: string
): Promise<ExtractedRecipe> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = renderPrompt("recipeFromUrl", {
    url,
    pageContent: pageContent.slice(0, 15000),
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Try to parse the JSON, handling potential markdown code blocks
  let jsonText = text.trim();
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.slice(7);
  }
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith("```")) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();

  const parsed = JSON.parse(jsonText);

  // Validate and normalize the response
  return {
    name: String(parsed.name || "Untitled Recipe"),
    description: String(parsed.description || ""),
    category: normalizeCategory(parsed.category),
    cuisine: String(parsed.cuisine || "Other"),
    ingredients: Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((item: Record<string, unknown>) => ({
          name: String(item.name || ""),
          quantity: typeof item.quantity === "number" ? item.quantity : null,
          unit: typeof item.unit === "string" ? item.unit : null,
          notes: typeof item.notes === "string" ? item.notes : null,
        }))
      : [],
  };
}

function normalizeCategory(category: unknown): string {
  const validCategories = [
    "entree",
    "side",
    "dessert",
    "appetizer",
    "breakfast",
    "soup",
    "salad",
    "beverage",
  ];
  const cat = String(category || "").toLowerCase();
  return validCategories.includes(cat) ? cat : "entree";
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
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

  // Parse request body
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { url } = body;
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  try {
    // Step 1: Fetch the web page (raw HTML)
    console.log(`[create-from-url] Fetching URL: ${url}`);
    const html = await fetchWebPage(url);
    console.log(`[create-from-url] Fetched ${html.length} characters of HTML`);

    // Step 2: Try JSON-LD extraction first (most reliable)
    let extracted = extractJsonLdRecipe(html);
    let extractionMethod = "json-ld";

    if (extracted && extracted.ingredients.length > 0) {
      console.log(`[create-from-url] Extracted recipe from JSON-LD: ${extracted.name} (${extracted.ingredients.length} ingredients)`);
    } else {
      // Fall back to AI extraction with cleaned HTML
      console.log(`[create-from-url] No JSON-LD found, falling back to AI extraction...`);
      const cleanedContent = cleanHtmlForExtraction(html);
      console.log(`[create-from-url] Cleaned content: ${cleanedContent.length} characters`);
      extracted = await extractRecipeWithAI(cleanedContent, url);
      extractionMethod = "ai";
      console.log(`[create-from-url] AI extracted recipe: ${extracted.name}`);
    }

    // Step 3: Check if recipe already exists
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("household_id", user.household_id)
      .eq("name", extracted.name)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `A recipe named "${extracted.name}" already exists` },
        { status: 409 }
      );
    }

    // Step 4: Create the recipe
    const { data: newRecipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        household_id: user.household_id,
        name: extracted.name,
        description: extracted.description,
        source_url: url,
        category: extracted.category,
        cuisine: extracted.cuisine,
        status: "wishlist",
        created_by: user.id,
      })
      .select("id, name")
      .single();

    if (recipeError || !newRecipe) {
      console.error("[create-from-url] Failed to create recipe:", recipeError);
      return NextResponse.json(
        { error: `Failed to create recipe: ${recipeError?.message}` },
        { status: 500 }
      );
    }

    console.log(`[create-from-url] Created recipe: ${newRecipe.id}`);

    // Step 5: Get existing ingredients and use AI for fuzzy matching
    const { data: existingIngredients } = await supabase
      .from("ingredients")
      .select("id, name")
      .eq("household_id", user.household_id);

    // Build exact match map
    const ingredientMap = new Map<string, string>();
    existingIngredients?.forEach((ing) => {
      ingredientMap.set(ing.name.toLowerCase(), ing.id);
    });

    // Use AI to fuzzy match extracted ingredients to existing ones
    const fuzzyMatchMap = new Map<string, string>();
    const extractedNames = extracted.ingredients.map((ing) => ing.name).filter(Boolean);

    if (existingIngredients && existingIngredients.length > 0 && extractedNames.length > 0) {
      const existingNames = existingIngredients.map((ing) => ing.name);

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const matchModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const matchPrompt = `You are matching recipe ingredients to an existing ingredient database.

EXISTING INGREDIENTS IN DATABASE:
${existingNames.map((name, i) => `${i + 1}. ${name}`).join("\n")}

INGREDIENTS TO MATCH:
${extractedNames.map((name, i) => `${i + 1}. ${name}`).join("\n")}

For each ingredient to match, find the best matching existing ingredient if one exists.
Consider these as matches:
- Plural/singular variations (e.g., "tomato" = "tomatoes")
- Preparation modifiers that don't change the core ingredient (e.g., "garlic" = "garlic cloves", "onion" = "diced onion")

DO NOT match these as the same ingredient:
- Different varieties/types (e.g., "olive oil" ≠ "vegetable oil", "chicken breast" ≠ "chicken thighs")
- Temperature/state modifiers that matter (e.g., "cold water" ≠ "water" - these are often separate ingredients in a recipe)
- Different forms (e.g., "butter" ≠ "melted butter" if both appear in the recipe)
- Different seasonings (e.g., "salt" ≠ "kosher salt" if both could be used differently)

Return a JSON array where each element corresponds to an ingredient to match.
Each element should be either:
- The EXACT name from the existing ingredients list (if a good match exists)
- null (if no good match exists and a new ingredient should be created)

Be CONSERVATIVE - when in doubt, return null. It's better to create a new ingredient than to incorrectly merge two distinct ingredients.

Return ONLY the JSON array, no other text. Example: ["existing ingredient 1", null, "existing ingredient 3"]`;

      try {
        const matchResult = await matchModel.generateContent(matchPrompt);
        const matchResponse = await matchResult.response;
        let matchJsonStr = matchResponse.text().trim();

        // Clean up potential markdown formatting
        if (matchJsonStr.startsWith("```json")) {
          matchJsonStr = matchJsonStr.slice(7);
        } else if (matchJsonStr.startsWith("```")) {
          matchJsonStr = matchJsonStr.slice(3);
        }
        if (matchJsonStr.endsWith("```")) {
          matchJsonStr = matchJsonStr.slice(0, -3);
        }
        matchJsonStr = matchJsonStr.trim();

        const matches: (string | null)[] = JSON.parse(matchJsonStr);

        // Build fuzzy match map
        for (let i = 0; i < extractedNames.length && i < matches.length; i++) {
          const extractedName = extractedNames[i].toLowerCase().trim();
          const matchedName = matches[i];

          if (matchedName) {
            const matchedIngredient = existingIngredients.find(
              (ing) => ing.name.toLowerCase() === matchedName.toLowerCase()
            );
            if (matchedIngredient) {
              fuzzyMatchMap.set(extractedName, matchedIngredient.id);
              console.log(`[create-from-url] Fuzzy matched: "${extractedNames[i]}" -> "${matchedName}"`);
            }
          }
        }
      } catch (matchError) {
        console.error("[create-from-url] Fuzzy matching failed, using exact match:", matchError);
      }
    }

    // Step 6: Create/link ingredients
    // Track linked ingredient IDs to avoid duplicate constraint violations
    const linkedIngredientIds = new Set<string>();
    let ingredientsCreated = 0;
    let ingredientsSkipped = 0;

    for (let j = 0; j < extracted.ingredients.length; j++) {
      const ing = extracted.ingredients[j];
      if (!ing.name) continue;

      const normalizedName = ing.name.toLowerCase().trim();

      // Try fuzzy match first, then exact match
      let ingredientId = fuzzyMatchMap.get(normalizedName) || ingredientMap.get(normalizedName);

      if (!ingredientId) {
        // Create new ingredient
        const { data: newIng } = await supabase
          .from("ingredients")
          .insert({
            household_id: user.household_id,
            name: ing.name.trim(),
          })
          .select("id")
          .single();

        ingredientId = newIng?.id;
        if (ingredientId) {
          ingredientMap.set(normalizedName, ingredientId);
        }
      }

      if (ingredientId) {
        // Check if this ingredient has already been linked (due to fuzzy matching collisions)
        if (linkedIngredientIds.has(ingredientId)) {
          console.log(`[create-from-url] Skipping duplicate ingredient link: "${ing.name}" -> ${ingredientId}`);
          ingredientsSkipped++;
          continue;
        }

        const { error: linkError } = await supabase
          .from("recipe_ingredients")
          .insert({
            recipe_id: newRecipe.id,
            ingredient_id: ingredientId,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes,
            sort_order: j,
          });

        if (!linkError) {
          ingredientsCreated++;
          linkedIngredientIds.add(ingredientId);
        } else {
          console.error(`[create-from-url] Failed to link ingredient "${ing.name}":`, linkError.message);
        }
      }
    }

    console.log(`[create-from-url] Created/linked ${ingredientsCreated} ingredients, skipped ${ingredientsSkipped} duplicates`);

    // Return success with debug info
    return NextResponse.json({
      success: true,
      recipe: {
        id: newRecipe.id,
        name: newRecipe.name,
      },
      debug: {
        urlFetched: url,
        extractionMethod,
        htmlLength: html.length,
        extraction: extracted,
        ingredientsCreated,
        ingredientsSkipped,
      },
    });
  } catch (error) {
    console.error("[create-from-url] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
