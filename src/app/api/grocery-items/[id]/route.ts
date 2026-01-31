import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

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

  // Verify the grocery item belongs to a grocery list in user's household
  const { data: groceryItem, error: itemError } = await supabase
    .from("grocery_items")
    .select(`
      id,
      grocery_list_id,
      grocery_list:grocery_list_id (
        weekly_plan:weekly_plan_id (
          household_id
        )
      )
    `)
    .eq("id", params.id)
    .single();

  if (itemError || !groceryItem) {
    return NextResponse.json({ error: "Grocery item not found" }, { status: 404 });
  }

  // Check household ownership - Supabase returns nested objects for foreign key joins

  const groceryListData = groceryItem.grocery_list as any;
  const weeklyPlanData = groceryListData?.weekly_plan;
  const householdId = weeklyPlanData?.household_id;

  if (!householdId || householdId !== user.household_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();

  // Update the grocery item
  const updateData: Record<string, unknown> = {};

  if (typeof body.checked === "boolean") {
    updateData.checked = body.checked;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updatedItem, error: updateError } = await supabase
    .from("grocery_items")
    .update(updateData)
    .eq("id", params.id)
    .select("id, checked")
    .single();

  if (updateError) {
    console.error("Failed to update grocery item:", updateError);
    return NextResponse.json(
      { error: "Failed to update grocery item" },
      { status: 500 }
    );
  }

  return NextResponse.json({ groceryItem: updatedItem });
}
