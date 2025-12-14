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

  // Get store with ingredients
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select(`
      *,
      ingredients (
        id,
        name,
        department
      )
    `)
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (storeError) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  return NextResponse.json({ store });
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

  const { data: store, error: updateError } = await supabase
    .from("stores")
    .update({
      name: body.name,
      sort_order: body.sort_order,
    })
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update store" },
      { status: 500 }
    );
  }

  return NextResponse.json({ store });
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
  const allowedFields = ["name", "sort_order"];

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

  const { data: store, error: updateError } = await supabase
    .from("stores")
    .update(updateData)
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update store" },
      { status: 500 }
    );
  }

  return NextResponse.json({ store });
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
    .from("stores")
    .delete()
    .eq("id", params.id)
    .eq("household_id", user.household_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete store. It may have ingredients assigned." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
