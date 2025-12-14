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

  // Get user's household
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  const { data: stores, error } = await supabase
    .from("stores")
    .select("*")
    .eq("household_id", user.household_id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch stores" },
      { status: 500 }
    );
  }

  return NextResponse.json({ stores });
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

  const { data: store, error: insertError } = await supabase
    .from("stores")
    .insert({
      household_id: user.household_id,
      name: body.name,
      sort_order: body.sort_order || 0,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to create store" },
      { status: 500 }
    );
  }

  return NextResponse.json({ store });
}
