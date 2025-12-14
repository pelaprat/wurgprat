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

    // Step 5: Create ingredients
    let ingredientsCreated = 0;
    for (let j = 0; j < extracted.ingredients.length; j++) {
      const ing = extracted.ingredients[j];
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
        const { error: linkError } = await supabase
          .from("recipe_ingredients")
          .insert({
            recipe_id: newRecipe.id,
            ingredient_id: ingredient.id,
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

    console.log(`[create-from-url] Created ${ingredientsCreated} ingredients`);

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
