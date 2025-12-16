import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface ExtractedIngredient {
  name: string;
  quantity?: number | string;
  unit?: string;
  notes?: string;
}

interface ExtractedRecipeData {
  description: string;
  category: string;
  cuisine: string;
  ingredients: ExtractedIngredient[];
}

// Helper to parse fraction strings like "1/2" to decimal
function parseFraction(value: number | string | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value;

  const str = String(value).trim();
  if (!str) return undefined;

  // Handle fractions like "1/2"
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const denom = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
        return num / denom;
      }
    }
  }

  // Handle mixed numbers like "1 1/2"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const denom = parseInt(mixedMatch[3]);
    if (!isNaN(whole) && !isNaN(num) && !isNaN(denom) && denom !== 0) {
      return whole + num / denom;
    }
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? undefined : parsed;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user's household
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Get the recipe
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  if (!recipe.source_url) {
    return NextResponse.json(
      { error: "Recipe has no source URL" },
      { status: 400 }
    );
  }

  try {
    // Check for Gemini API key first
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Please add it to .env.local" },
        { status: 500 }
      );
    }

    // Fetch the web page
    console.log("Fetching recipe page:", recipe.source_url);
    const pageResponse = await fetch(recipe.source_url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MealPlannerBot/1.0)",
      },
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch recipe page: ${pageResponse.status}` },
        { status: 400 }
      );
    }

    const html = await pageResponse.text();
    console.log("Fetched HTML length:", html.length);

    // Use Gemini to extract ingredients
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Extract recipe information from this webpage. Return a JSON object with the following structure:
{
  "description": "A refined 1-2 sentence description of the recipe, written in an appealing way",
  "category": "one of: entree, side, dessert, appetizer, breakfast, soup, salad, beverage",
  "cuisine": "the cuisine type (e.g., Italian, Mexican, American, Asian, Mediterranean, Indian, etc.)",
  "ingredients": [
    {
      "name": "ingredient name (just the ingredient, no quantity or preparation notes)",
      "quantity": number or null,
      "unit": "unit of measurement" or null,
      "notes": "preparation notes like 'diced', 'room temperature'" or null
    }
  ]
}

Guidelines:
- "description" should be a polished, appetizing 1-2 sentence summary (not just copied from the page)
- "category" must be one of the listed options, choose the best fit
- "cuisine" should identify the culinary tradition

For ingredients, "2 cups all-purpose flour, sifted" should become:
{"name": "all-purpose flour", "quantity": 2, "unit": "cups", "notes": "sifted"}

And "1 large egg, room temperature" should become:
{"name": "egg", "quantity": 1, "unit": "large", "notes": "room temperature"}

Return ONLY the JSON object, no other text.

HTML content:
${html.slice(0, 50000)}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Parse the response
    const responseText = response.text();

    // Extract JSON from the response (handle potential markdown code blocks)
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    let extractedData: ExtractedRecipeData;
    try {
      const parsed = JSON.parse(jsonStr);

      // Normalize category
      const validCategories = ["entree", "side", "dessert", "appetizer", "breakfast", "soup", "salad", "beverage"];
      const category = validCategories.includes(String(parsed.category || "").toLowerCase())
        ? String(parsed.category).toLowerCase()
        : "entree";

      extractedData = {
        description: String(parsed.description || ""),
        category,
        cuisine: String(parsed.cuisine || "Other"),
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      };
    } catch {
      return NextResponse.json(
        { error: "Failed to parse recipe data from AI response" },
        { status: 500 }
      );
    }

    const extractedIngredients = extractedData.ingredients;

    if (!Array.isArray(extractedIngredients)) {
      return NextResponse.json(
        { error: "Invalid ingredient data from AI" },
        { status: 500 }
      );
    }

    // Update the recipe with description, category, and cuisine
    const { error: updateError } = await supabase
      .from("recipes")
      .update({
        description: extractedData.description || null,
        category: extractedData.category || null,
        cuisine: extractedData.cuisine || null,
      })
      .eq("id", params.id)
      .eq("household_id", user.household_id);

    if (updateError) {
      console.error("Failed to update recipe:", updateError);
    }

    // Get existing ingredients for the household
    const { data: existingIngredients } = await supabase
      .from("ingredients")
      .select("id, name")
      .eq("household_id", user.household_id);

    // Build a map for quick exact match lookup
    const ingredientMap = new Map<string, string>();
    existingIngredients?.forEach((ing) => {
      ingredientMap.set(ing.name.toLowerCase(), ing.id);
    });

    // Use AI to fuzzy match extracted ingredients to existing ones
    let fuzzyMatchMap = new Map<string, string | null>();

    if (existingIngredients && existingIngredients.length > 0 && extractedIngredients.length > 0) {
      const extractedNames = extractedIngredients.map(ing => ing.name);
      const existingNames = existingIngredients.map(ing => ing.name);

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
        const matchResult = await model.generateContent(matchPrompt);
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
            // Find the ID for the matched ingredient
            const matchedIngredient = existingIngredients.find(
              ing => ing.name.toLowerCase() === matchedName.toLowerCase()
            );
            if (matchedIngredient) {
              fuzzyMatchMap.set(extractedName, matchedIngredient.id);
              console.log(`Fuzzy matched: "${extractedNames[i]}" -> "${matchedName}"`);
            }
          }
        }
      } catch (matchError) {
        console.error("Fuzzy matching failed, falling back to exact match:", matchError);
        // Continue with exact matching only
      }
    }

    // Deduplicate ingredients - combine duplicates into notes
    const deduplicatedIngredients: Map<string, ExtractedIngredient & { sortOrder: number }> = new Map();
    for (let i = 0; i < extractedIngredients.length; i++) {
      const extracted = extractedIngredients[i];
      const normalizedName = extracted.name.toLowerCase().trim();

      if (deduplicatedIngredients.has(normalizedName)) {
        // Combine with existing entry
        const existing = deduplicatedIngredients.get(normalizedName)!;
        const newNote = [
          existing.notes,
          extracted.notes,
          `also: ${extracted.quantity || ""} ${extracted.unit || ""}`.trim()
        ].filter(Boolean).join("; ");
        existing.notes = newNote || undefined;
      } else {
        deduplicatedIngredients.set(normalizedName, {
          ...extracted,
          quantity: parseFraction(extracted.quantity),
          sortOrder: i,
        });
      }
    }

    // Process each extracted ingredient
    const recipeIngredients = [];

    for (const [normalizedName, extracted] of Array.from(deduplicatedIngredients.entries())) {
      // First try fuzzy match, then exact match
      let ingredientId = fuzzyMatchMap.get(normalizedName) || ingredientMap.get(normalizedName);

      // Create ingredient if it doesn't exist
      if (!ingredientId) {
        const { data: newIngredient, error: createError } = await supabase
          .from("ingredients")
          .insert({
            household_id: user.household_id,
            name: extracted.name.trim(),
          })
          .select()
          .single();

        if (createError) {
          // Try to get it again in case of race condition
          const { data: existing } = await supabase
            .from("ingredients")
            .select("id")
            .eq("household_id", user.household_id)
            .ilike("name", extracted.name.trim())
            .single();

          ingredientId = existing?.id;
        } else if (newIngredient?.id) {
          ingredientId = newIngredient.id;
          ingredientMap.set(normalizedName, newIngredient.id);
        }
      }

      if (ingredientId) {
        recipeIngredients.push({
          recipe_id: params.id,
          ingredient_id: ingredientId,
          quantity: extracted.quantity,
          unit: extracted.unit,
          notes: extracted.notes,
          sort_order: extracted.sortOrder,
        });
      }
    }

    // Delete existing recipe ingredients
    await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("recipe_id", params.id);

    // Insert new recipe ingredients
    if (recipeIngredients.length > 0) {
      const { error: insertError } = await supabase
        .from("recipe_ingredients")
        .insert(recipeIngredients);

      if (insertError) {
        console.error("Failed to insert recipe ingredients:", insertError);
        return NextResponse.json(
          { error: "Failed to save ingredients" },
          { status: 500 }
        );
      }
    }

    // Return the imported ingredients
    const { data: savedIngredients } = await supabase
      .from("recipe_ingredients")
      .select(
        `
        id,
        quantity,
        unit,
        notes,
        sort_order,
        ingredient:ingredients(id, name, department)
      `
      )
      .eq("recipe_id", params.id)
      .order("sort_order");

    return NextResponse.json({
      success: true,
      count: savedIngredients?.length || 0,
      ingredients: savedIngredients,
      recipe: {
        description: extractedData.description,
        category: extractedData.category,
        cuisine: extractedData.cuisine,
      },
    });
  } catch (error) {
    console.error("Error importing ingredients:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to import ingredients: ${errorMessage}` },
      { status: 500 }
    );
  }
}
