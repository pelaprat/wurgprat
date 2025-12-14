import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

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
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plan")
    .select(`
      *,
      meals (
        id,
        day,
        meal_type,
        custom_meal_name,
        is_leftover,
        notes,
        recipe:recipes (
          id,
          name,
          time_rating,
          yields_leftovers
        )
      ),
      grocery_list (
        id,
        notes,
        grocery_items (
          id,
          quantity,
          unit,
          checked,
          ingredient:ingredients (
            id,
            name,
            department
          )
        )
      )
    `)
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (planError) {
    return NextResponse.json({ error: "Weekly plan not found" }, { status: 404 });
  }

  return NextResponse.json({ weeklyPlan });
}

export async function PUT(
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
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  const body = await request.json();

  const { data: weeklyPlan, error: updateError } = await supabase
    .from("weekly_plan")
    .update({
      notes: body.notes,
    })
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update weekly plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ weeklyPlan });
}

export async function DELETE(
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
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("weekly_plan")
    .delete()
    .eq("id", params.id)
    .eq("household_id", user.household_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete weekly plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
