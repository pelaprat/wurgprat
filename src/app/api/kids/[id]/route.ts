import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

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

  const { data: kid, error: kidError } = await supabase
    .from("kids")
    .select("*")
    .eq("id", id)
    .eq("household_id", user.household_id)
    .single();

  if (kidError) {
    return NextResponse.json({ error: "Kid not found" }, { status: 404 });
  }

  // Fetch allowance splits for this kid
  const { data: splits } = await supabase
    .from("allowance_splits")
    .select("*")
    .eq("kid_id", id);

  return NextResponse.json({
    kid: {
      ...kid,
      allowance_splits: splits || [],
    },
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

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

  if (!body.first_name?.trim()) {
    return NextResponse.json(
      { error: "First name is required" },
      { status: 400 }
    );
  }

  const { data: kid, error: updateError } = await supabase
    .from("kids")
    .update({
      first_name: body.first_name.trim(),
      last_name: body.last_name?.trim() || null,
      email: body.email?.trim() || null,
      birth_date: body.birth_date || null,
      allowance_balance: body.allowance_balance ?? 0,
      prat_points: body.prat_points ?? 0,
    })
    .eq("id", id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update kid:", updateError);

    let errorMessage = "Failed to update kid";
    if (updateError.code === "42P01") {
      errorMessage = "Database table not found. Please run the kids migration.";
    } else if (updateError.message) {
      errorMessage = `Database error: ${updateError.message}`;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }

  return NextResponse.json({ kid });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

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
  const allowedFields = [
    "first_name",
    "last_name",
    "email",
    "birth_date",
    "allowance_balance",
    "prat_points",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Trim string fields
      if (typeof body[field] === "string") {
        updateData[field] = body[field].trim() || null;
      } else {
        updateData[field] = body[field];
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: kid, error: updateError } = await supabase
    .from("kids")
    .update(updateData)
    .eq("id", id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update kid:", updateError);

    let errorMessage = "Failed to update kid";
    if (updateError.code === "42P01") {
      errorMessage = "Database table not found. Please run the kids migration.";
    } else if (updateError.message) {
      errorMessage = `Database error: ${updateError.message}`;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }

  return NextResponse.json({ kid });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

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
    .from("kids")
    .delete()
    .eq("id", id)
    .eq("household_id", user.household_id);

  if (deleteError) {
    console.error("Failed to delete kid:", deleteError);

    let errorMessage = "Failed to delete kid";
    if (deleteError.code === "42P01") {
      errorMessage = "Database table not found. Please run the kids migration.";
    } else if (deleteError.message) {
      errorMessage = `Database error: ${deleteError.message}`;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
