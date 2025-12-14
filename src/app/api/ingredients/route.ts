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

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search");
  const department = searchParams.get("department");
  const storeId = searchParams.get("store_id");

  // Build query
  let query = supabase
    .from("ingredients")
    .select(`
      *,
      store:stores (
        id,
        name
      )
    `)
    .eq("household_id", user.household_id)
    .order("name", { ascending: true });

  // Apply filters
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }
  if (department) {
    query = query.eq("department", department);
  }
  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { data: ingredients, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch ingredients" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ingredients });
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
  const { name, department, store_id } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Ingredient name is required" },
      { status: 400 }
    );
  }

  // Check if ingredient already exists (case-insensitive)
  const { data: existing } = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("household_id", user.household_id)
    .ilike("name", name.trim())
    .single();

  if (existing) {
    return NextResponse.json({ ingredient: existing });
  }

  // Create new ingredient
  const { data: ingredient, error: createError } = await supabase
    .from("ingredients")
    .insert({
      household_id: user.household_id,
      name: name.trim(),
      department: department || null,
      store_id: store_id || null,
    })
    .select(`
      *,
      store:stores (
        id,
        name
      )
    `)
    .single();

  if (createError) {
    console.error("Failed to create ingredient:", createError);
    return NextResponse.json(
      { error: "Failed to create ingredient" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ingredient }, { status: 201 });
}
