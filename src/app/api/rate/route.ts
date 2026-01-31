import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getServiceSupabase } from "@/lib/supabase";

/**
 * Generate an HMAC token for email rating links.
 * Prevents users from guessing/tampering with URLs.
 */
export function generateRatingToken(
  recipeId: string,
  userId: string,
  rating: number
): string {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || "";
  return createHmac("sha256", secret)
    .update(`${recipeId}:${userId}:${rating}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * GET /api/rate?recipe=ID&user=ID&rating=N&token=HMAC
 *
 * Called when a user clicks a rating link in the reminder email.
 * Upserts the rating and redirects to the recipe page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const recipeId = searchParams.get("recipe");
  const userId = searchParams.get("user");
  const ratingStr = searchParams.get("rating");
  const token = searchParams.get("token");

  if (!recipeId || !userId || !ratingStr || !token) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const rating = parseInt(ratingStr, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  // Verify HMAC token
  const expectedToken = generateRatingToken(recipeId, userId, rating);
  if (token !== expectedToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const supabase = getServiceSupabase();

  // Upsert the rating
  const { error: saveError } = await supabase
    .from("recipe_ratings")
    .upsert(
      {
        recipe_id: recipeId,
        user_id: userId,
        rating,
      },
      { onConflict: "recipe_id,user_id" }
    );

  if (saveError) {
    console.error("Failed to save rating from email:", saveError);
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }

  // Redirect to the recipe page
  const baseUrl = process.env.NEXTAUTH_URL || "https://wurgprat.com";
  return NextResponse.redirect(`${baseUrl}/recipes/${recipeId}?rated=${rating}`);
}
