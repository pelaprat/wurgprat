import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

// GET all ratings for a recipe
export async function GET(
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
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Verify recipe belongs to household
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // Get all ratings for this recipe with user info
  const { data: ratings, error: ratingsError } = await supabase
    .from("recipe_ratings")
    .select(`
      id,
      rating,
      created_at,
      updated_at,
      user:users(id, name, email)
    `)
    .eq("recipe_id", params.id);

  if (ratingsError) {
    console.error("Failed to fetch ratings:", ratingsError);
    return NextResponse.json(
      { error: "Failed to fetch ratings" },
      { status: 500 }
    );
  }

  // Find current user's rating
  const currentUserRating = ratings?.find((r) => {
    if (!r.user) return false;
    // Supabase can return user as an array or object depending on the query
    const userData = Array.isArray(r.user) ? r.user[0] : r.user;
    return userData?.id === user.id;
  });

  return NextResponse.json({
    ratings: ratings || [],
    currentUserRating: currentUserRating || null,
    currentUserId: user.id,
  });
}

// POST or update a rating
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify recipe belongs to household
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const body = await request.json();
  const { rating } = body;

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  // Upsert the rating (insert or update if exists)
  const { data: savedRating, error: saveError } = await supabase
    .from("recipe_ratings")
    .upsert(
      {
        recipe_id: params.id,
        user_id: user.id,
        rating: Math.round(rating),
      },
      {
        onConflict: "recipe_id,user_id",
      }
    )
    .select(`
      id,
      rating,
      created_at,
      updated_at,
      user:users(id, name, email)
    `)
    .single();

  if (saveError) {
    console.error("Failed to save rating:", saveError);
    return NextResponse.json(
      { error: "Failed to save rating" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    rating: savedRating,
    message: "Rating saved successfully",
  });
}

// DELETE a rating
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Delete the user's rating for this recipe
  const { error: deleteError } = await supabase
    .from("recipe_ratings")
    .delete()
    .eq("recipe_id", params.id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Failed to delete rating:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete rating" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Rating deleted successfully",
  });
}
