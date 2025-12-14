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

  const { data: weeklyPlans, error } = await supabase
    .from("weekly_plan")
    .select(`
      *,
      meals:meals (
        id,
        day,
        meal_type,
        recipe:recipes (
          id,
          name
        )
      )
    `)
    .eq("household_id", user.household_id)
    .order("week_of", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch weekly plans" },
      { status: 500 }
    );
  }

  return NextResponse.json({ weeklyPlans });
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  const body = await request.json();

  const { data: weeklyPlan, error: insertError } = await supabase
    .from("weekly_plan")
    .insert({
      household_id: user.household_id,
      week_of: body.week_of,
      notes: body.notes,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "A plan for this week already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create weekly plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ weeklyPlan });
}
