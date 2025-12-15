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
    return NextResponse.json(
      { error: "Household not found" },
      { status: 404 }
    );
  }

  // Get household settings and name
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("name, timezone, settings")
    .eq("id", user.household_id)
    .single();

  if (householdError) {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    name: household.name,
    timezone: household.timezone || "America/New_York",
    settings: household.settings || {}
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { cooked_recipes_sheet_url, wishlist_recipes_sheet_url, google_calendar_id, timezone } = body;

  const supabase = getServiceSupabase();

  // Get user's household
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json(
      { error: "Household not found" },
      { status: 404 }
    );
  }

  // Get current settings
  const { data: household } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  // Merge new settings with existing
  const updatedSettings = {
    ...(household?.settings || {}),
    cooked_recipes_sheet_url,
    wishlist_recipes_sheet_url,
    google_calendar_id,
  };

  // Build update object
  const updateData: { settings: typeof updatedSettings; timezone?: string } = {
    settings: updatedSettings,
  };

  // Only update timezone if provided
  if (timezone) {
    updateData.timezone = timezone;
  }

  // Update household settings
  const { error: updateError } = await supabase
    .from("households")
    .update(updateData)
    .eq("id", user.household_id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ settings: updatedSettings, timezone });
}
