import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import type { AllowanceSplitConfig } from "@/types";

// Default split configuration
const DEFAULT_SPLITS: AllowanceSplitConfig[] = [
  { key: "charity", name: "Charity", percentage: 10 },
  { key: "saving", name: "Saving", percentage: 20 },
  { key: "spending", name: "Spending", percentage: 70 },
];

/**
 * GET /api/settings/allowance-splits
 * Get the household's allowance split configuration
 */
export async function GET() {
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

  // Get household settings
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  if (householdError) {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }

  const splits: AllowanceSplitConfig[] =
    household?.settings?.allowance_splits || DEFAULT_SPLITS;

  return NextResponse.json({ splits });
}

/**
 * PUT /api/settings/allowance-splits
 * Update the household's allowance split configuration
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { splits } = body;

  // Validate splits
  if (!Array.isArray(splits) || splits.length !== 3) {
    return NextResponse.json(
      { error: "Must provide exactly 3 splits" },
      { status: 400 }
    );
  }

  // Validate each split
  for (const split of splits) {
    if (!split.key || typeof split.key !== "string") {
      return NextResponse.json(
        { error: "Each split must have a key" },
        { status: 400 }
      );
    }
    if (!split.name || typeof split.name !== "string") {
      return NextResponse.json(
        { error: "Each split must have a name" },
        { status: 400 }
      );
    }
    if (
      typeof split.percentage !== "number" ||
      split.percentage < 0 ||
      split.percentage > 100
    ) {
      return NextResponse.json(
        { error: "Each split must have a percentage between 0 and 100" },
        { status: 400 }
      );
    }
  }

  // Validate percentages sum to 100
  const totalPercentage = splits.reduce(
    (sum: number, s: AllowanceSplitConfig) => sum + s.percentage,
    0
  );
  if (totalPercentage !== 100) {
    return NextResponse.json(
      { error: `Percentages must sum to 100 (currently ${totalPercentage})` },
      { status: 400 }
    );
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

  // Get current settings
  const { data: household } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  // Update settings with new splits
  const updatedSettings = {
    ...(household?.settings || {}),
    allowance_splits: splits.map((s: AllowanceSplitConfig) => ({
      key: s.key,
      name: s.name.trim(),
      percentage: s.percentage,
    })),
  };

  const { error: updateError } = await supabase
    .from("households")
    .update({ settings: updatedSettings })
    .eq("id", user.household_id);

  if (updateError) {
    console.error("Failed to update settings:", updateError);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    splits: updatedSettings.allowance_splits,
  });
}
