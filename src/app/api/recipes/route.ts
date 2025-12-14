import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
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

  // Parse query params for filtering and sorting
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sortBy") || "name";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  // Build query - include ingredient count
  let query = supabase
    .from("recipes")
    .select("*, recipe_ingredients(count)")
    .eq("household_id", user.household_id);

  // Apply filters
  if (status) {
    query = query.eq("status", status);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  const { data: recipes, error } = await query;

  if (error) {
    console.error("Failed to fetch recipes:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }

  // Fetch all ratings for these recipes
  const recipeIds = recipes?.map((r) => r.id) || [];
  const { data: allRatings } = await supabase
    .from("recipe_ratings")
    .select("recipe_id, rating")
    .in("recipe_id", recipeIds);

  // Group ratings by recipe_id
  const ratingsByRecipe: Record<string, number[]> = {};
  allRatings?.forEach((r) => {
    if (!ratingsByRecipe[r.recipe_id]) {
      ratingsByRecipe[r.recipe_id] = [];
    }
    ratingsByRecipe[r.recipe_id].push(r.rating);
  });

  // Calculate average rating for each recipe
  const recipesWithAvgRating = recipes?.map((recipe) => {
    const ratings = ratingsByRecipe[recipe.id] || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;
    return {
      ...recipe,
      average_rating: avgRating,
    };
  });

  return NextResponse.json({ recipes: recipesWithAvgRating });
}
