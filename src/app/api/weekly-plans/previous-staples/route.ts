import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user's household
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Get weekOf from query params
  const searchParams = request.nextUrl.searchParams;
  const weekOf = searchParams.get("weekOf");

  if (!weekOf) {
    return NextResponse.json({ error: "weekOf parameter required" }, { status: 400 });
  }

  // Find the most recent weekly plan before the specified week
  const { data: previousPlan, error: planError } = await supabase
    .from("weekly_plan")
    .select("id, week_of")
    .eq("household_id", user.household_id)
    .lt("week_of", weekOf)
    .order("week_of", { ascending: false })
    .limit(1)
    .single();

  if (planError && planError.code !== "PGRST116") {
    console.error("Failed to fetch previous plan:", planError);
    return NextResponse.json({ error: "Failed to fetch previous plan" }, { status: 500 });
  }

  // No previous plan found
  if (!previousPlan) {
    return NextResponse.json({ staples: [], previousWeekOf: null });
  }

  // Get the grocery list for that plan
  const { data: groceryList, error: groceryListError } = await supabase
    .from("grocery_list")
    .select("id")
    .eq("weekly_plan_id", previousPlan.id)
    .single();

  if (groceryListError && groceryListError.code !== "PGRST116") {
    console.error("Failed to fetch grocery list:", groceryListError);
    return NextResponse.json({ error: "Failed to fetch grocery list" }, { status: 500 });
  }

  // No grocery list found for that plan
  if (!groceryList) {
    return NextResponse.json({ staples: [], previousWeekOf: previousPlan.week_of });
  }

  // Get staple items from the grocery list
  const { data: stapleItems, error: staplesError } = await supabase
    .from("grocery_items")
    .select(`
      id,
      ingredient_id,
      quantity,
      unit,
      ingredients (
        id,
        name,
        department,
        store_id,
        store:stores (
          id,
          name
        )
      )
    `)
    .eq("grocery_list_id", groceryList.id)
    .eq("is_staple", true);

  if (staplesError) {
    console.error("Failed to fetch staple items:", staplesError);
    return NextResponse.json({ error: "Failed to fetch staple items" }, { status: 500 });
  }

  // Transform to the format expected by the frontend
  const staples = (stapleItems || []).map((item) => {
    const ingredient = item.ingredients as unknown as {
      id: string;
      name: string;
      department: string | null;
      store_id: string | null;
      store: { id: string; name: string } | null;
    };

    return {
      id: `staple-${item.ingredient_id}-${Date.now()}`,
      ingredientId: item.ingredient_id,
      ingredientName: ingredient?.name || "Unknown",
      department: ingredient?.department || "Other",
      storeId: ingredient?.store_id || undefined,
      storeName: ingredient?.store?.name || undefined,
      quantity: item.quantity?.toString() || "1",
      unit: item.unit || "",
    };
  });

  return NextResponse.json({
    staples,
    previousWeekOf: previousPlan.week_of,
  });
}
