import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body;

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
    .select("id, name")
    .ilike("name", trimmedName)
    .single();

  let householdId: string;
  let joined: boolean;

  if (existingHousehold) {
    // Join the existing household
    householdId = existingHousehold.id;
    joined = true;
    console.log(`User ${session.user.email} joining existing household: ${existingHousehold.name}`);
  } else {
    // Create a new household
    const { data: newHousehold, error: householdError } = await supabase
      .from("households")
      .insert({
        name: trimmedName,
        settings: {
          default_meal_time: "19:00",
          week_start_day: "saturday",
          calendar_id: "primary",
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
