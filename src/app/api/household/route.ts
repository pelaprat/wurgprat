import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import crypto from "crypto";

/**
 * Generate a random invitation code
 * Format: 6 alphanumeric characters (easily readable/shareable)
 */
function generateInvitationCode(): string {
  // Use base36 (0-9, a-z) for readable codes
  return crypto.randomBytes(4).toString("base64url").slice(0, 6).toUpperCase();
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, invitation_code } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Household name is required" },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Check if user already has a household
  let { data: user } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  // If user doesn't exist, create them (fallback for race condition or failed signIn callback)
  if (!user) {
    console.log("User not found, creating user for:", session.user.email);
    const { data: newUser, error: createUserError } = await supabase
      .from("users")
      .upsert(
        {
          email: session.user.email,
          name: session.user.name,
          picture: session.user.image,
        },
        { onConflict: "email" }
      )
      .select("id, household_id")
      .single();

    if (createUserError || !newUser) {
      console.error("Failed to create user:", createUserError);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
    user = newUser;
  }

  if (user.household_id) {
    return NextResponse.json(
      { error: "User already belongs to a household" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();

  // Check if a household with this name already exists
  const { data: existingHousehold } = await supabase
    .from("households")
    .select("id, name, settings")
    .ilike("name", trimmedName)
    .single();

  let householdId: string;
  let joined: boolean;

  if (existingHousehold) {
    // To join an existing household, user must provide the correct invitation code
    const storedCode = existingHousehold.settings?.invitation_code;

    if (!invitation_code) {
      return NextResponse.json(
        {
          error: "This household already exists. Please provide the invitation code to join.",
          requires_invitation_code: true
        },
        { status: 400 }
      );
    }

    // Validate invitation code (case-insensitive comparison)
    if (!storedCode || invitation_code.toUpperCase() !== storedCode.toUpperCase()) {
      return NextResponse.json(
        { error: "Invalid invitation code" },
        { status: 403 }
      );
    }

    householdId = existingHousehold.id;
    joined = true;
    console.log(`User ${session.user.email} joining existing household with valid invitation code: ${existingHousehold.name}`);
  } else {
    // Create a new household with an invitation code
    const newInvitationCode = generateInvitationCode();

    const { data: newHousehold, error: householdError } = await supabase
      .from("households")
      .insert({
        name: trimmedName,
        settings: {
          default_meal_time: "19:00",
          week_start_day: "saturday",
          calendar_id: "primary",
          invitation_code: newInvitationCode,
          departments: [
            "Produce",
            "Meat & Seafood",
            "Dairy",
            "Pantry",
            "Frozen",
            "Bakery",
            "Other",
          ],
        },
      })
      .select("id")
      .single();

    if (householdError || !newHousehold) {
      console.error("Failed to create household:", householdError);
      return NextResponse.json(
        { error: "Failed to create household" },
        { status: 500 }
      );
    }

    householdId = newHousehold.id;
    joined = false;
    console.log(`User ${session.user.email} created new household: ${trimmedName}`);
  }

  // Assign user to the household
  const { error: updateError } = await supabase
    .from("users")
    .update({ household_id: householdId })
    .eq("id", user.id);

  if (updateError) {
    console.error("Failed to assign user to household:", updateError);
    return NextResponse.json(
      { error: "Failed to assign user to household" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    household_id: householdId,
    joined,
    household_name: trimmedName,
  });
}

/**
 * GET - Get current household info including invitation code (for sharing)
 */
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

  // Get household with members
  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("id, name, settings")
    .eq("id", user.household_id)
    .single();

  if (householdError || !household) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Get household members
  const { data: members } = await supabase
    .from("users")
    .select("id, name, email, picture")
    .eq("household_id", user.household_id);

  return NextResponse.json({
    household: {
      id: household.id,
      name: household.name,
      invitation_code: household.settings?.invitation_code,
      member_count: members?.length || 0,
      members: members || [],
    },
  });
}

/**
 * PATCH - Regenerate invitation code
 */
export async function PATCH() {
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

  // Get current settings
  const { data: household } = await supabase
    .from("households")
    .select("settings")
    .eq("id", user.household_id)
    .single();

  // Generate new invitation code
  const newInvitationCode = generateInvitationCode();

  // Update settings with new code
  const { error: updateError } = await supabase
    .from("households")
    .update({
      settings: {
        ...household?.settings,
        invitation_code: newInvitationCode,
      },
    })
    .eq("id", user.household_id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to regenerate invitation code" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    invitation_code: newInvitationCode,
    message: "Invitation code regenerated successfully",
  });
}
