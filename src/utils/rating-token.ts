import { createHmac } from "crypto";

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
