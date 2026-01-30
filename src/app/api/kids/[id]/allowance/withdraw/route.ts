import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/kids/[id]/allowance/withdraw
 * Withdraw from a specific split
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { amount, split_key, description } = body;

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be a positive number" },
      { status: 400 }
    );
  }

  if (!split_key || typeof split_key !== "string") {
    return NextResponse.json(
      { error: "split_key is required" },
      { status: 400 }
    );
  }

  if (!description || typeof description !== "string" || !description.trim()) {
    return NextResponse.json(
      { error: "Description is required for withdrawals" },
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

  // Get the split to withdraw from
  const { data: split, error: splitError } = await supabase
    .from("allowance_splits")
    .select("id, balance")
    .eq("kid_id", id)
    .eq("split_key", split_key)
    .single();

  if (splitError || !split) {
    return NextResponse.json(
      { error: `No balance found for split: ${split_key}` },
      { status: 404 }
    );
  }

  if (split.balance < amount) {
    return NextResponse.json(
      { error: `Insufficient balance. Available: $${split.balance.toFixed(2)}` },
      { status: 400 }
    );
  }

  // Update the split balance
  const newBalance = split.balance - amount;
  const { data: updatedSplit, error: updateError } = await supabase
    .from("allowance_splits")
    .update({ balance: newBalance })
    .eq("id", split.id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update split:", updateError);
    return NextResponse.json(
      { error: "Failed to process withdrawal" },
      { status: 500 }
    );
  }

  // Create transaction record
  const { data: transaction, error: txError } = await supabase
    .from("allowance_transactions")
    .insert({
      kid_id: id,
      split_key,
      amount: -amount, // Negative for withdrawals
      transaction_type: "withdrawal",
      description: description.trim(),
      created_by: user.id,
    })
    .select()
    .single();

  if (txError) {
    console.error("Failed to create transaction:", txError);
    // Continue anyway - split was updated
  }

  // Update the legacy allowance_balance field on kids table for backwards compatibility
  const { error: kidUpdateError } = await supabase
    .from("kids")
    .update({ allowance_balance: Math.max(0, kid.allowance_balance - amount) })
    .eq("id", id);

  if (kidUpdateError) {
    console.error("Failed to update kid allowance_balance:", kidUpdateError);
  }

  return NextResponse.json({
    success: true,
    amount,
    split_key,
    new_balance: newBalance,
    transaction,
    split: updatedSplit,
  });
}
