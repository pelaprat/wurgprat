import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

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

  const { data: kids, error } = await supabase
    .from("kids")
    .select("*")
    .eq("household_id", user.household_id)
    .order("birth_date", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch kids" },
      { status: 500 }
    );
  }

  // Fetch allowance splits for all kids
  interface AllowanceSplitRow {
    id: string;
    kid_id: string;
    split_key: string;
    balance: number;
    created_at: string;
    updated_at: string;
  }

  const kidIds = kids?.map((k) => k.id) || [];
  let splitsMap: Record<string, AllowanceSplitRow[]> = {};

  if (kidIds.length > 0) {
    const { data: splits } = await supabase
      .from("allowance_splits")
      .select("*")
      .in("kid_id", kidIds);

    if (splits) {
      splitsMap = splits.reduce((acc, split) => {
        if (!acc[split.kid_id]) {
          acc[split.kid_id] = [];
        }
        acc[split.kid_id].push(split);
        return acc;
      }, {} as Record<string, AllowanceSplitRow[]>);
    }
  }

  // Attach splits to each kid
  const kidsWithSplits = kids?.map((kid) => ({
    ...kid,
    allowance_splits: splitsMap[kid.id] || [],
  }));

  return NextResponse.json({ kids: kidsWithSplits });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();

  if (!body.first_name?.trim()) {
    return NextResponse.json(
      { error: "First name is required" },
      { status: 400 }
    );
  }

  const { data: kid, error: insertError } = await supabase
    .from("kids")
    .insert({
      household_id: user.household_id,
      first_name: body.first_name.trim(),
      last_name: body.last_name?.trim() || null,
      email: body.email?.trim() || null,
      birth_date: body.birth_date || null,
      allowance_balance: body.allowance_balance ?? 0,
      prat_points: body.prat_points ?? 0,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to create kid:", insertError);

    // Provide more helpful error messages
    let errorMessage = "Failed to create kid";
    if (insertError.code === "42P01") {
      errorMessage = "Database table not found. Please run the kids migration.";
    } else if (insertError.message) {
      errorMessage = `Database error: ${insertError.message}`;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }

  return NextResponse.json({ kid });
}
