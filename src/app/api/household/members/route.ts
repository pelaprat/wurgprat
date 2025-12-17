import { NextResponse } from "next/server";
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

  // Get all members of the household
  const { data: members, error: membersError } = await supabase
    .from("users")
    .select("id, name, email, picture")
    .eq("household_id", user.household_id)
    .order("name");

  if (membersError) {
    console.error("Failed to fetch household members:", membersError);
    return NextResponse.json(
      { error: "Failed to fetch household members" },
      { status: 500 }
    );
  }

  return NextResponse.json({ members: members || [] });
}
