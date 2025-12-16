import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderPrompt } from "@/prompts";

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

// Fetch a webpage and extract its text content
async function fetchWebPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MealPlannerBot/1.0; +https://mealplanner.app)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Basic HTML to text conversion - remove scripts, styles, and tags
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
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
    // Step 1: Fetch the web page
    console.log(`[create-from-url] Fetching URL: ${url}`);
    const pageContent = await fetchWebPage(url);
    console.log(`[create-from-url] Fetched ${pageContent.length} characters`);

    // Step 2: Extract recipe data with AI
    console.log(`[create-from-url] Extracting recipe with Gemini...`);
    const extracted = await extractRecipeWithAI(pageContent, url);
    console.log(`[create-from-url] Extracted recipe: ${extracted.name}`);

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
- With/without modifiers (e.g., "olive oil" = "extra virgin olive oil", "chicken breast" = "boneless skinless chicken breasts")
- Common variations (e.g., "garlic" = "garlic cloves", "butter" = "unsalted butter")

Return a JSON array where each element corresponds to an ingredient to match.
Each element should be either:
- The EXACT name from the existing ingredients list (if a good match exists)
- null (if no good match exists and a new ingredient should be created)

Only match if you're confident it's the same core ingredient. Don't match different ingredients.
For example, "chicken breast" should NOT match "chicken thighs" - these are different cuts.

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
    let ingredientsCreated = 0;
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
        }
      }
    }

    console.log(`[create-from-url] Created/linked ${ingredientsCreated} ingredients`);

    // Return success with debug info
    return NextResponse.json({
      success: true,
      recipe: {
        id: newRecipe.id,
        name: newRecipe.name,
      },
      debug: {
        urlFetched: url,
        contentLength: pageContent.length,
        contentPreview: pageContent.slice(0, 500) + "...",
        aiExtraction: extracted,
        ingredientsCreated,
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
