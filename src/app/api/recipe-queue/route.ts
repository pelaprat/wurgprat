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

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  const { data: items, error } = await supabase
    .from("recipe_queue")
    .select(`
      id,
      recipe_id,
      notes,
      created_at,
      user_id,
      recipes (id, name, cuisine, time_rating, source_url),
      users (id, name)
    `)
    .eq("household_id", user.household_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch recipe queue:", error);
    return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500 });
  }

  return NextResponse.json({ items, currentUserId: user.id });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  const body = await request.json();
  const { recipeId, notes } = body as { recipeId: string; notes?: string };

  if (!recipeId) {
    return NextResponse.json({ error: "recipeId is required" }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("recipe_queue")
    .insert({
      household_id: user.household_id,
      user_id: user.id,
      recipe_id: recipeId,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Recipe already in queue" }, { status: 409 });
    }
    console.error("Failed to add to queue:", error);
    return NextResponse.json({ error: "Failed to add to queue" }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 201 });
}
