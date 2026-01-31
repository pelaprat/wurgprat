import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getServiceSupabase } from "@/lib/supabase";
import { getTodayInTimezone, getCurrentHourInTimezone } from "@/utils/timezone";
import { generateRatingToken } from "@/app/api/rate/route";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Fetch all households with their timezone
  const { data: households, error: householdError } = await supabase
    .from("households")
    .select("id, name, timezone");

  if (householdError || !households) {
    console.error("Failed to fetch households:", householdError);
    return NextResponse.json({ error: "Failed to fetch households" }, { status: 500 });
  }

  // Allow bypassing the time filter with ?force=true
  const force = request.nextUrl.searchParams.get("force") === "true";

  // Filter to households where local time is 9pm (unless forced)
  const targetHouseholds = force
    ? households
    : households.filter((h) => {
        const tz = h.timezone || "America/New_York";
        const hour = getCurrentHourInTimezone(tz);
        return hour === 21;
      });

  if (targetHouseholds.length === 0) {
    return NextResponse.json({ message: "No households at 9pm", emailsSent: 0 });
  }

  let totalEmailsSent = 0;
  const errors: string[] = [];

  for (const household of targetHouseholds) {
    try {
      const tz = household.timezone || "America/New_York";
      const todayStr = getTodayInTimezone(tz);

      // Find the weekly plan containing today
      const { data: weeklyPlans } = await supabase
        .from("weekly_plan")
        .select("id, week_of")
        .eq("household_id", household.id)
        .order("week_of", { ascending: false });

      if (!weeklyPlans?.length) continue;

      const todayDate = new Date(`${todayStr}T00:00:00`);
      let matchedPlan: { id: string; week_of: string } | null = null;
      let dayOfWeek = 1;

      for (const plan of weeklyPlans) {
        const weekStart = new Date(plan.week_of + "T00:00:00");
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        if (todayDate >= weekStart && todayDate < weekEnd) {
          matchedPlan = plan;
          const diffTime = todayDate.getTime() - weekStart.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          dayOfWeek = diffDays + 1;
          break;
        }
      }

      if (!matchedPlan) continue;

      // Get dinner meals with recipes for today
      const { data: meals } = await supabase
        .from("meals")
        .select("id, recipe_id, recipes(id, name)")
        .eq("weekly_plan_id", matchedPlan.id)
        .eq("day", dayOfWeek)
        .eq("meal_type", "dinner")
        .not("recipe_id", "is", null);

      if (!meals?.length) continue;

      // Get all users in this household
      const { data: users } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("household_id", household.id);

      if (!users?.length) continue;

      const recipeIds = meals
        .map((m) => m.recipe_id)
        .filter((id): id is string => id !== null);

      // Get existing ratings for these recipes
      const { data: existingRatings } = await supabase
        .from("recipe_ratings")
        .select("recipe_id, user_id")
        .in("recipe_id", recipeIds)
        .in(
          "user_id",
          users.map((u) => u.id)
        );

      const ratedSet = new Set(
        (existingRatings || []).map((r) => `${r.recipe_id}:${r.user_id}`)
      );

      const baseUrl = process.env.NEXTAUTH_URL || "https://wurgprat.com";

      // Send emails for each unrated recipe/user combo
      for (const meal of meals) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recipe = meal.recipes as any;
        if (!recipe?.id || !recipe?.name) continue;

        for (const user of users) {
          if (ratedSet.has(`${recipe.id}:${user.id}`)) continue;
          if (!user.email) continue;

          const firstName = user.name?.split(" ")[0] || user.email.split("@")[0];

          // Build rating URLs with HMAC tokens for each star value
          const ratingUrls: string[] = [];
          for (let r = 1; r <= 5; r++) {
            const token = generateRatingToken(recipe.id, user.id, r);
            ratingUrls.push(
              `${baseUrl}/api/rate?recipe=${recipe.id}&user=${user.id}&rating=${r}&token=${token}`
            );
          }

          try {
            await resend.emails.send({
              from: "Wurgprat <noreply@wurgprat.com>",
              to: user.email,
              subject: `How was ${recipe.name}?`,
              html: buildEmailHtml(firstName, recipe.name, ratingUrls),
            });
            totalEmailsSent++;
          } catch (emailError) {
            console.error(
              `Failed to send email to ${user.email} for recipe ${recipe.name}:`,
              emailError
            );
            errors.push(`${user.email}:${recipe.name}`);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing household ${household.id}:`, err);
      errors.push(`household:${household.id}`);
    }
  }

  return NextResponse.json({
    message: "Rating reminders processed",
    householdsChecked: targetHouseholds.length,
    emailsSent: totalEmailsSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}

function buildEmailHtml(
  firstName: string,
  recipeName: string,
  ratingUrls: string[]
): string {
  const starButtons = ratingUrls
    .map(
      (url) => `
                    <td align="center" style="padding:0 3px;">
                      <a href="${url}" style="display:inline-block;width:44px;height:44px;line-height:44px;text-decoration:none;font-size:32px;color:#facc15;">
                        &#9733;
                      </a>
                    </td>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:32px 24px;">
              <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Hey ${firstName}!</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.5;">
                Tonight you had <strong>${recipeName}</strong>. How was it?
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${starButtons}
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
                1 star = not great &middot; 5 stars = loved it
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
                Sent by Wurgprat
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
