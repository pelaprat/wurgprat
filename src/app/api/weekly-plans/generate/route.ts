import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderPrompt } from "@/prompts";

interface Recipe {
  id: string;
  name: string;
  description?: string;
  time_rating?: number;
  cost_rating?: number;
  yields_leftovers?: boolean;
  category?: string;
  cuisine?: string;
  last_made?: string;
  average_rating?: number;
}

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  all_day: boolean;
}

interface ProposedMeal {
  mealId: string;
  day: number;
  date: string;
  recipeId?: string;
  recipeName: string;
  recipeTimeRating?: number;
  aiReasoning?: string;
  isAiSuggested: boolean;
  sortOrder?: number;
}

// Get dates for a week starting from Saturday
function getWeekDates(saturdayDate: string): string[] {
  const start = new Date(saturdayDate + "T00:00:00");
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
}

// Day names starting Saturday
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
  const { weekOf, userDescription, selectedRecipeIds } = body as {
    weekOf: string;
    userDescription: string;
    selectedRecipeIds: string[];
  };

  if (!weekOf) {
    return NextResponse.json(
      { error: "weekOf is required" },
      { status: 400 }
    );
  }

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

  console.log(`[generate] Fetched ${recipes?.length || 0} recipes for household ${user.household_id}`);

  if (recipesError) {
    console.error("[generate] Failed to fetch recipes:", recipesError);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }

  if (!recipes || recipes.length === 0) {
    return NextResponse.json(
      { error: "No recipes found in your household. Please add some recipes first." },
      { status: 400 }
    );
  }

  // Fetch events for the week
  const weekDates = getWeekDates(weekOf);
  const startDate = weekDates[0];
  const endDate = weekDates[6] + "T23:59:59";

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_time, end_time, all_day")
    .eq("household_id", user.household_id)
    .gte("start_time", startDate)
    .lte("start_time", endDate)
    .order("start_time");

  if (eventsError) {
    console.error("Failed to fetch events:", eventsError);
    // Continue without events
  }

  // Build prompt for AI
  const selectedRecipes = recipes.filter((r) =>
    selectedRecipeIds.includes(r.id)
  );
  const otherRecipes = recipes.filter(
    (r) => !selectedRecipeIds.includes(r.id)
  );

  console.log(`[generate] Selected recipes: ${selectedRecipes.length}, Other recipes: ${otherRecipes.length}`);
  if (selectedRecipes.length > 0) {
    console.log(`[generate] User selected: ${selectedRecipes.map(r => r.name).join(", ")}`);
  }

  const eventsByDay: Record<string, Event[]> = {};
  weekDates.forEach((date) => {
    eventsByDay[date] = [];
  });
  (events || []).forEach((event) => {
    const eventDate = new Date(event.start_time).toISOString().split("T")[0];
    if (eventsByDay[eventDate]) {
      eventsByDay[eventDate].push(event);
    }
  });

  // Build context for AI
  const recipeList = (recipes || [])
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
      const isSelected = selectedRecipeIds.includes(r.id);
      return `- ${r.name} [ID: ${r.id}] (Time: ${timeLabel}, Cuisine: ${r.cuisine || "N/A"}, Category: ${r.category || "entree"}${r.yields_leftovers ? ", Yields leftovers" : ""}${isSelected ? ", USER SELECTED" : ""})`;
    })
    .join("\n");

  const scheduleContext = weekDates
    .map((date, index) => {
      const dayEvents = eventsByDay[date] || [];
      const dayName = DAY_NAMES[index];
      if (dayEvents.length === 0) {
        return `${dayName} (${date}): No events - flexible schedule`;
      }
      const eventList = dayEvents
        .map((e) =>
          e.all_day
            ? `${e.title} (all day)`
            : `${e.title} at ${new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
        )
        .join(", ");
      return `${dayName} (${date}): ${eventList} - BUSY DAY, suggest quick meal`;
    })
    .join("\n");

  const prompt = renderPrompt("mealPlanGeneration", {
    weekOf,
    userDescription: userDescription || "No specific preferences provided.",
    scheduleContext,
    recipeList,
    hasSelectedRecipes: selectedRecipeIds.length > 0,
    firstDate: weekDates[0],
    secondDate: weekDates[1],
  });

  console.log(`[generate] Prompt length: ${prompt.length} chars`);
  console.log(`[generate] Recipe list preview: ${recipeList.substring(0, 500)}...`);

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

    // Build a map of valid recipe IDs for quick lookup
    const validRecipeIds = new Set((recipes || []).map((r) => r.id));
    const recipeMap = new Map((recipes || []).map((r) => [r.id, r]));

    // Track which recipes have been used (to avoid duplicates in fallback)
    const usedRecipeIds = new Set<string>();

    // Validate and transform the response
    const proposedMeals: ProposedMeal[] = (parsed.meals || []).map(
      (meal: {
        day: number;
        date: string;
        recipeId: string;
        recipeName: string;
        reasoning: string;
      }, index: number) => {
        // CRITICAL: Validate that the recipe ID exists in our household's recipes
        let recipeId = meal.recipeId;
        let recipe = recipeMap.get(recipeId);

        // If the AI returned an invalid recipe ID, find a fallback
        if (!recipe || !validRecipeIds.has(recipeId)) {
          console.warn(
            `AI returned invalid recipe ID: ${recipeId} (${meal.recipeName}). Finding fallback.`
          );

          // Try to find a recipe by name match first
          const nameMatch = (recipes || []).find(
            (r) =>
              r.name.toLowerCase() === meal.recipeName?.toLowerCase() &&
              !usedRecipeIds.has(r.id)
          );

          if (nameMatch) {
            recipe = nameMatch;
            recipeId = nameMatch.id;
          } else {
            // Fall back to any unused recipe, preferring selected ones
            const fallbackRecipe = (recipes || []).find(
              (r) =>
                !usedRecipeIds.has(r.id) &&
                (selectedRecipeIds.includes(r.id) ||
                  !selectedRecipeIds.length)
            ) || (recipes || []).find((r) => !usedRecipeIds.has(r.id));

            if (fallbackRecipe) {
              recipe = fallbackRecipe;
              recipeId = fallbackRecipe.id;
            } else {
              // Last resort: reuse a recipe
              recipe = recipes?.[0];
              recipeId = recipe?.id || "";
            }
          }
        }

        usedRecipeIds.add(recipeId);

        // If the recipe was in the user's selected list, mark as NOT AI suggested
        const wasUserSelected = selectedRecipeIds.includes(recipeId);

        return {
          mealId: `meal-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          day: meal.day,
          date: meal.date,
          recipeId: recipeId,
          recipeName: recipe?.name || meal.recipeName || "Unknown",
          recipeTimeRating: recipe?.time_rating,
          aiReasoning: meal.reasoning,
          isAiSuggested: !wasUserSelected,
          sortOrder: 0, // First meal of the day
        };
      }
    );

    return NextResponse.json({
      proposedMeals,
      aiExplanation: parsed.explanation || "",
    });
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate meal plan" },
      { status: 500 }
    );
  }
}
