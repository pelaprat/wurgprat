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

  // Get ingredient with store and recipes that use it
  const { data: ingredient, error: ingredientError } = await supabase
    .from("ingredients")
    .select(`
      *,
      store:stores (
        id,
        name
      ),
      recipe_ingredients (
        id,
        quantity,
        unit,
        recipe:recipes (
          id,
          name,
          status
        )
      )
    `)
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (ingredientError) {
    return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
  }

  return NextResponse.json({ ingredient });
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

  const { data: ingredient, error: updateError } = await supabase
    .from("ingredients")
    .update({
      name: body.name,
      store_id: body.store_id,
      department: body.department,
    })
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update ingredient" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ingredient });
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
  const updateData: Record<string, unknown> = {};
  const allowedFields = ["name", "store_id", "department"];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: ingredient, error: updateError } = await supabase
    .from("ingredients")
    .update(updateData)
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .select(`
      *,
      store:stores (
        id,
        name
      )
    `)
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update ingredient" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ingredient });
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
    .from("ingredients")
    .delete()
    .eq("id", params.id)
    .eq("household_id", user.household_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete ingredient. It may be used in recipes." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
