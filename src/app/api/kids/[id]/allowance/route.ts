import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import type { AllowanceSplitConfig } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Default split configuration if household doesn't have one
const DEFAULT_SPLITS: AllowanceSplitConfig[] = [
  { key: "charity", name: "Charity", percentage: 10 },
  { key: "saving", name: "Saving", percentage: 20 },
  { key: "spending", name: "Spending", percentage: 70 },
];

/**
 * GET /api/kids/[id]/allowance
 * Get the kid's allowance splits and balances
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

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

  // Verify kid belongs to household
  const { data: kid, error: kidError } = await supabase
    .from("kids")
    .select("id, first_name")
    .eq("id", id)
    .eq("household_id", user.household_id)
    .single();

  if (kidError || !kid) {
    return NextResponse.json({ error: "Kid not found" }, { status: 404 });
  }

  // Get household settings for split configuration
  const { data: household } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  const splitConfig: AllowanceSplitConfig[] =
    household?.settings?.allowance_splits || DEFAULT_SPLITS;

  // Get current splits for this kid
  const { data: splits, error: splitsError } = await supabase
    .from("allowance_splits")
    .select("*")
    .eq("kid_id", id);

  if (splitsError) {
    console.error("Failed to fetch splits:", splitsError);
    return NextResponse.json(
      { error: "Failed to fetch allowance splits" },
      { status: 500 }
    );
  }

  // Build response with balances for each configured split
  const balances = splitConfig.map((config) => {
    const split = splits?.find((s) => s.split_key === config.key);
    return {
      key: config.key,
      name: config.name,
      percentage: config.percentage,
      balance: split?.balance || 0,
    };
  });

  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);

  return NextResponse.json({
    kid_id: id,
    kid_name: kid.first_name,
    total_balance: totalBalance,
    splits: balances,
    split_config: splitConfig,
  });
}

/**
 * POST /api/kids/[id]/allowance
 * Add allowance to a kid (auto-splits based on household configuration)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { amount, description } = body;

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be a positive number" },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get user's household and user id
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Verify kid belongs to household
  const { data: kid, error: kidError } = await supabase
    .from("kids")
    .select("id, first_name, allowance_balance")
    .eq("id", id)
    .eq("household_id", user.household_id)
    .single();

  if (kidError || !kid) {
    return NextResponse.json({ error: "Kid not found" }, { status: 404 });
  }

  // Get household settings for split configuration
  const { data: household } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  const splitConfig: AllowanceSplitConfig[] =
    household?.settings?.allowance_splits || DEFAULT_SPLITS;

  // Calculate split amounts
  const splitAmounts = splitConfig.map((config) => ({
    key: config.key,
    name: config.name,
    amount: Math.round((amount * config.percentage) / 100 * 100) / 100, // Round to 2 decimal places
  }));

  // Adjust for rounding errors - add any remaining cents to spending
  const totalSplit = splitAmounts.reduce((sum, s) => sum + s.amount, 0);
  const diff = Math.round((amount - totalSplit) * 100) / 100;
  if (diff !== 0) {
    const spendingIdx = splitAmounts.findIndex((s) => s.key === "spending");
    if (spendingIdx >= 0) {
      splitAmounts[spendingIdx].amount += diff;
    } else {
      // If no spending split, add to last one
      splitAmounts[splitAmounts.length - 1].amount += diff;
    }
  }

  // Update or create splits and create transactions
  const transactions = [];
  const updatedSplits = [];

  for (const split of splitAmounts) {
    if (split.amount <= 0) continue;

    // Upsert the split balance
    const { data: existingSplit } = await supabase
      .from("allowance_splits")
      .select("id, balance")
      .eq("kid_id", id)
      .eq("split_key", split.key)
      .single();

    if (existingSplit) {
      // Update existing
      const newBalance = existingSplit.balance + split.amount;
      const { data: updated, error: updateError } = await supabase
        .from("allowance_splits")
        .update({ balance: newBalance })
        .eq("id", existingSplit.id)
        .select()
        .single();

      if (updateError) {
        console.error("Failed to update split:", updateError);
        return NextResponse.json(
          { error: "Failed to update allowance split" },
          { status: 500 }
        );
      }
      updatedSplits.push(updated);
    } else {
      // Create new
      const { data: created, error: createError } = await supabase
        .from("allowance_splits")
        .insert({
          kid_id: id,
          split_key: split.key,
          balance: split.amount,
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create split:", createError);
        return NextResponse.json(
          { error: "Failed to create allowance split" },
          { status: 500 }
        );
      }
      updatedSplits.push(created);
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from("allowance_transactions")
      .insert({
        kid_id: id,
        split_key: split.key,
        amount: split.amount,
        transaction_type: "deposit",
        description: description || `Allowance deposit`,
        created_by: user.id,
      })
      .select()
      .single();

    if (txError) {
      console.error("Failed to create transaction:", txError);
      // Continue anyway - split was updated
    } else {
      transactions.push(transaction);
    }
  }

  // Update the legacy allowance_balance field on kids table for backwards compatibility
  const { error: kidUpdateError } = await supabase
    .from("kids")
    .update({ allowance_balance: kid.allowance_balance + amount })
    .eq("id", id);

  if (kidUpdateError) {
    console.error("Failed to update kid allowance_balance:", kidUpdateError);
  }

  return NextResponse.json({
    success: true,
    amount,
    splits: splitAmounts,
    transactions,
  });
}
