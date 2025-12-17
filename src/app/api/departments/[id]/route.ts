import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

// PATCH - Update a department
export async function PATCH(
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

  // Verify department belongs to user's household
  const { data: existingDept, error: deptError } = await supabase
    .from("departments")
    .select("id, household_id")
    .eq("id", params.id)
    .single();

  if (deptError || !existingDept) {
    return NextResponse.json(
      { error: "Department not found" },
      { status: 404 }
    );
  }

  if (existingDept.household_id !== user.household_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const updates: { name?: string; sort_order?: number } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Department name cannot be empty" },
        { status: 400 }
      );
    }
    updates.name = body.name.trim();
  }

  if (body.sort_order !== undefined) {
    updates.sort_order = body.sort_order;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: department, error: updateError } = await supabase
    .from("departments")
    .update(updates)
    .eq("id", params.id)
    .select("id, name, sort_order, created_at")
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json(
        { error: "A department with this name already exists" },
        { status: 409 }
      );
    }
    console.error("Failed to update department:", updateError);
    return NextResponse.json(
      { error: "Failed to update department" },
      { status: 500 }
    );
  }

  return NextResponse.json({ department });
}

// DELETE - Delete a department
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

  // Verify department belongs to user's household
  const { data: existingDept, error: deptError } = await supabase
    .from("departments")
    .select("id, household_id")
    .eq("id", params.id)
    .single();

  if (deptError || !existingDept) {
    return NextResponse.json(
      { error: "Department not found" },
      { status: 404 }
    );
  }

  if (existingDept.household_id !== user.household_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if any ingredients are using this department
  const { count } = await supabase
    .from("ingredients")
    .select("id", { count: "exact", head: true })
    .eq("department_id", params.id);

  if (count && count > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete department. ${count} ingredient(s) are using it. Please reassign them first.`,
      },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from("departments")
    .delete()
    .eq("id", params.id);

  if (deleteError) {
    console.error("Failed to delete department:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete department" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
