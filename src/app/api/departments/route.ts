import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

// GET - List all departments for the household
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

  // Get all departments for the household
  const { data: departments, error: deptError } = await supabase
    .from("departments")
    .select("id, name, sort_order, created_at")
    .eq("household_id", user.household_id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (deptError) {
    console.error("Failed to fetch departments:", deptError);
    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 }
    );
  }

  return NextResponse.json({ departments: departments || [] });
}

// POST - Create a new department
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
  const { name, sort_order } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Department name is required" },
      { status: 400 }
    );
  }

  // Get the max sort_order if not provided
  let order = sort_order;
  if (order === undefined || order === null) {
    const { data: maxOrder } = await supabase
      .from("departments")
      .select("sort_order")
      .eq("household_id", user.household_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    order = (maxOrder?.sort_order ?? -1) + 1;
  }

  // Create the department
  const { data: department, error: createError } = await supabase
    .from("departments")
    .insert({
      household_id: user.household_id,
      name: name.trim(),
      sort_order: order,
    })
    .select("id, name, sort_order, created_at")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      return NextResponse.json(
        { error: "A department with this name already exists" },
        { status: 409 }
      );
    }
    console.error("Failed to create department:", createError);
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 }
    );
  }

  return NextResponse.json({ department }, { status: 201 });
}
