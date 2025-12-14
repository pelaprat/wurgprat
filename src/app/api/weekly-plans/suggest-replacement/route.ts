import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderPrompt } from "@/prompts";

interface Event {
  id: string;
  title: string;
  start_time: string;
  all_day: boolean;
}

const DAY_NAMES = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 500 }
    );
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

  // Parse request
  const body = await request.json();
  const { day, date, currentRecipeId, excludeRecipeIds, events } = body as {
    day: number;
    date: string;
    currentRecipeId?: string;
    excludeRecipeIds: string[];
    events: Event[];
  };

  // Fetch all recipes for the household
  const { data: recipes, error: recipesError } = await supabase
    .from("recipes")
    .select(`
      id,
      name,
      description,
      time_rating,
      cost_rating,
      yields_leftovers,
      category,
      cuisine,
      last_made,
      status
    `)
    .eq("household_id", user.household_id)
    .order("name");

  console.log(`[suggest-replacement] Fetched ${recipes?.length || 0} recipes`);

  if (recipesError) {
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }

  // Filter out already-used recipes
  const availableRecipes = (recipes || []).filter(
    (r) => !excludeRecipeIds.includes(r.id) || r.id === currentRecipeId
  );

  if (availableRecipes.length === 0) {
    return NextResponse.json(
      { error: "No available recipes to suggest" },
      { status: 400 }
    );
  }

  const dayName = DAY_NAMES[day - 1] || "Unknown";
  const isBusy = events && events.length > 0;

  // Build recipe list
  const recipeList = availableRecipes
    .map((r) => {
      const timeLabel =
        r.time_rating === 1
          ? "Very Quick"
          : r.time_rating === 2
            ? "Quick"
            : r.time_rating === 3
              ? "Medium"
              : r.time_rating === 4
                ? "Long"
                : r.time_rating === 5
                  ? "Very Long"
                  : "Unknown";
      return `- ${r.name} [ID: ${r.id}] (Time: ${timeLabel}, Cuisine: ${r.cuisine || "N/A"}, Category: ${r.category || "entree"}${r.yields_leftovers ? ", Yields leftovers" : ""})`;
    })
    .join("\n");

  const eventContext =
    events && events.length > 0
      ? events
          .map((e) =>
            e.all_day
              ? `${e.title} (all day)`
              : `${e.title} at ${new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
          )
          .join(", ")
      : "No events";

  const prompt = renderPrompt("mealReplacement", {
    dayName,
    date,
    eventContext,
    isBusy,
    recipeList,
    hasCurrentRecipe: !!currentRecipeId,
  });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text().trim();

    // Extract JSON from markdown code blocks if present
    if (responseText.startsWith("```json")) {
      responseText = responseText.slice(7);
    }
    if (responseText.startsWith("```")) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith("```")) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    const parsed = JSON.parse(responseText);

    // CRITICAL: Validate that the recipe ID exists in our available recipes
    let recipeId = parsed.recipeId;
    let recipe = availableRecipes.find((r) => r.id === recipeId);

    // If the AI returned an invalid recipe ID, find a fallback
    if (!recipe) {
      console.warn(
        `AI returned invalid recipe ID: ${recipeId} (${parsed.recipeName}). Finding fallback.`
      );

      // Try to find a recipe by name match first
      const nameMatch = availableRecipes.find(
        (r) => r.name.toLowerCase() === parsed.recipeName?.toLowerCase()
      );

      if (nameMatch) {
        recipe = nameMatch;
        recipeId = nameMatch.id;
      } else {
        // Fall back to any available recipe, preferring quick ones on busy days
        const fallbackRecipe = isBusy
          ? availableRecipes.find((r) => r.time_rating && r.time_rating <= 2) ||
            availableRecipes[0]
          : availableRecipes[0];

        if (fallbackRecipe) {
          recipe = fallbackRecipe;
          recipeId = fallbackRecipe.id;
        } else {
          return NextResponse.json(
            { error: "No valid recipes available for suggestion" },
            { status: 400 }
          );
        }
      }
    }

    return NextResponse.json({
      suggestion: {
        recipeId: recipeId,
        recipeName: recipe.name,
        recipeTimeRating: recipe.time_rating,
        aiReasoning: parsed.reasoning,
        isAiSuggested: true,
      },
    });
  } catch (error) {
    console.error("AI suggestion error:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 }
    );
  }
}
