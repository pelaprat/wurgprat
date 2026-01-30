import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/kids/[id]/allowance/transactions
 * Get transaction history for a kid
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
    .select("household_id")
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

  // Parse query params for pagination and filtering
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const splitKey = url.searchParams.get("split_key");

  // Build query
  let query = supabase
    .from("allowance_transactions")
    .select("*")
    .eq("kid_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (splitKey) {
    query = query.eq("split_key", splitKey);
  }

  const { data: transactions, error: txError } = await query;

  if (txError) {
    console.error("Failed to fetch transactions:", txError);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }

  // Get user names for created_by
  const userIds = Array.from(new Set(transactions?.map((t) => t.created_by).filter(Boolean)));
  let userMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);

    if (users) {
      userMap = users.reduce((acc, u) => {
        acc[u.id] = u.name || "Unknown";
        return acc;
      }, {} as Record<string, string>);
    }
  }

  // Enrich transactions with user names
  const enrichedTransactions = transactions?.map((t) => ({
    ...t,
    created_by_name: t.created_by ? userMap[t.created_by] : null,
  }));

  // Get total count for pagination
  let countQuery = supabase
    .from("allowance_transactions")
    .select("*", { count: "exact", head: true })
    .eq("kid_id", id);

  if (splitKey) {
    countQuery = countQuery.eq("split_key", splitKey);
  }

  const { count } = await countQuery;

  return NextResponse.json({
    transactions: enrichedTransactions || [],
    pagination: {
      total: count || 0,
      limit,
      offset,
      has_more: (offset + limit) < (count || 0),
    },
  });
}
