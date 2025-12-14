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

  // Get recipe with ingredients
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select(`
      *,
      recipe_ingredients (
        id,
        quantity,
        unit,
        notes,
        sort_order,
        ingredient:ingredients (
          id,
          name,
          department,
          store:stores (
            id,
            name
          )
        )
      )
    `)
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (recipeError) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json({ recipe });
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

  // Update recipe
  const { data: recipe, error: updateError } = await supabase
    .from("recipes")
    .update({
      name: body.name,
      description: body.description,
      source: body.source,
      source_url: body.source_url,
      servings: body.servings,
      cost_rating: body.cost_rating,
      time_rating: body.time_rating,
      rating_emily: body.rating_emily,
      rating_etienne: body.rating_etienne,
      yields_leftovers: body.yields_leftovers,
      category: body.category,
      cuisine: body.cuisine,
      instructions: body.instructions,
      notes: body.notes,
      tags: body.tags,
      status: body.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update recipe" },
      { status: 500 }
    );
  }

  return NextResponse.json({ recipe });
}

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

  const body = await request.json();

  // Only update provided fields
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const allowedFields = [
    "name", "description", "source", "source_url", "servings",
    "cost_rating", "time_rating", "yields_leftovers",
    "category", "cuisine", "instructions", "notes", "tags", "status"
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const { data: recipe, error: updateError } = await supabase
    .from("recipes")
    .update(updateData)
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update recipe" },
      { status: 500 }
    );
  }

  return NextResponse.json({ recipe });
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
    .from("recipes")
    .delete()
    .eq("id", params.id)
    .eq("household_id", user.household_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete recipe" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
