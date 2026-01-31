import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

// PUT - Replace all assignments for an event in a weekly plan
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

  // Verify the weekly plan belongs to the user's household
  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plan")
    .select("id, household_id")
    .eq("id", params.id)
    .single();

  if (planError || !weeklyPlan) {
    return NextResponse.json({ error: "Weekly plan not found" }, { status: 404 });
  }

  if (weeklyPlan.household_id !== user.household_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { event_id, user_ids } = body as { event_id: string; user_ids: string[] };

  if (!event_id) {
    return NextResponse.json({ error: "event_id is required" }, { status: 400 });
  }

  if (!Array.isArray(user_ids)) {
    return NextResponse.json({ error: "user_ids must be an array" }, { status: 400 });
  }

  // Delete existing assignments for this event in this weekly plan
  const { error: deleteError } = await supabase
    .from("weekly_plan_event_assignments")
    .delete()
    .eq("weekly_plan_id", params.id)
    .eq("event_id", event_id);

  if (deleteError) {
    console.error("Failed to delete existing assignments:", deleteError);
    return NextResponse.json(
      { error: "Failed to update event assignments" },
      { status: 500 }
    );
  }

  // Insert new assignments
  if (user_ids.length > 0) {
    const assignmentsToInsert = user_ids.map((userId) => ({
      weekly_plan_id: params.id,
      event_id,
      user_id: userId,
    }));

    const { error: insertError } = await supabase
      .from("weekly_plan_event_assignments")
      .insert(assignmentsToInsert);

    if (insertError) {
      console.error("Failed to insert new assignments:", insertError);
      return NextResponse.json(
        { error: "Failed to update event assignments" },
        { status: 500 }
      );
    }
  }

  // Fetch updated assignments with user info
  const { data: updatedAssignments, error: fetchError } = await supabase
    .from("weekly_plan_event_assignments")
    .select(`
      user:users (
        id,
        name,
        email
      )
    `)
    .eq("weekly_plan_id", params.id)
    .eq("event_id", event_id);

  if (fetchError) {
    console.error("Failed to fetch updated assignments:", fetchError);
  }


  const assignedUsers = (updatedAssignments || []).map((a: any) => a.user).filter(Boolean);

  return NextResponse.json({
    event_id,
    assigned_users: assignedUsers,
  });
}
