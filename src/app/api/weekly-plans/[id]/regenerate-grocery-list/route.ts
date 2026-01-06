import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

// Try to aggregate quantities with same unit, accounting for recipe occurrences
function aggregateQuantities(
  items: { quantity: number | null; unit: string | null; occurrences: number }[]
): { quantity: number | null; unit: string } {
  // Filter to items with quantities
  const withQty = items.filter((i) => i.quantity != null);

  if (withQty.length === 0) {
    // No quantities defined - count total occurrences
    const totalOccurrences = items.reduce((sum, i) => sum + i.occurrences, 0);
    return { quantity: totalOccurrences, unit: "" };
  }

  // Group by unit, multiplying by occurrences
  const byUnit: Record<string, number> = {};
  withQty.forEach((item) => {
    const unit = (item.unit || "").toLowerCase().trim();
    const totalForItem = (item.quantity || 0) * item.occurrences;
    byUnit[unit] = (byUnit[unit] || 0) + totalForItem;
  });

  // If all same unit, sum them
  const units = Object.keys(byUnit);
  if (units.length === 1) {
    const unit = units[0];
    const total = byUnit[unit];
    return { quantity: total, unit };
  }

  // Multiple units - take the first one with combined quantity (simplified)
  const firstUnit = units[0];
  const total = byUnit[firstUnit];
  return { quantity: total, unit: firstUnit };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: weeklyPlanId } = await params;
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

  // Verify the weekly plan exists and belongs to the user's household
  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plan")
    .select("id, household_id")
    .eq("id", weeklyPlanId)
    .single();

  if (planError || !weeklyPlan) {
    return NextResponse.json({ error: "Weekly plan not found" }, { status: 404 });
  }

  if (weeklyPlan.household_id !== user.household_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch meals for this weekly plan with their recipes
  const { data: meals, error: mealsError } = await supabase
    .from("meals")
    .select(`
      id,
      recipe_id,
      recipes (
        id,
        name
      )
    `)
    .eq("weekly_plan_id", weeklyPlanId)
    .not("recipe_id", "is", null);

  if (mealsError) {
    console.error("Failed to fetch meals:", mealsError);
    return NextResponse.json({ error: "Failed to fetch meals" }, { status: 500 });
  }

  // Count recipe occurrences
  const recipeOccurrences: Record<string, { count: number; name: string }> = {};
  (meals || []).forEach((meal) => {
    if (meal.recipe_id && meal.recipes) {
      const recipe = meal.recipes as unknown as { id: string; name: string };
      if (!recipeOccurrences[meal.recipe_id]) {
        recipeOccurrences[meal.recipe_id] = { count: 0, name: recipe.name };
      }
      recipeOccurrences[meal.recipe_id].count++;
    }
  });

  const uniqueRecipeIds = Object.keys(recipeOccurrences);

  // Get or create grocery list for this weekly plan
  let { data: groceryList, error: groceryListError } = await supabase
    .from("grocery_list")
    .select("id")
    .eq("weekly_plan_id", weeklyPlanId)
    .single();

  if (groceryListError && groceryListError.code !== "PGRST116") {
    console.error("Failed to fetch grocery list:", groceryListError);
    return NextResponse.json({ error: "Failed to fetch grocery list" }, { status: 500 });
  }

  if (!groceryList) {
    // Create a new grocery list
    const { data: newList, error: createError } = await supabase
      .from("grocery_list")
      .insert({
        weekly_plan_id: weeklyPlanId,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (createError) {
      console.error("Failed to create grocery list:", createError);
      return NextResponse.json({ error: "Failed to create grocery list" }, { status: 500 });
    }
    groceryList = newList;
  } else {
    // Delete existing grocery items
    const { error: deleteError } = await supabase
      .from("grocery_items")
      .delete()
      .eq("grocery_list_id", groceryList.id);

    if (deleteError) {
      console.error("Failed to delete existing grocery items:", deleteError);
      return NextResponse.json({ error: "Failed to delete existing grocery items" }, { status: 500 });
    }
  }

  // If no recipes, return empty grocery list
  if (uniqueRecipeIds.length === 0) {
    return NextResponse.json({
      success: true,
      groceryList: { id: groceryList.id, grocery_items: [] }
    });
  }

  // Fetch recipe ingredients for all recipes
  const { data: recipeIngredients, error: ingredientsError } = await supabase
    .from("recipe_ingredients")
    .select(`
      recipe_id,
      ingredient_id,
      quantity,
      unit,
      notes,
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
    .in("recipe_id", uniqueRecipeIds);

  if (ingredientsError) {
    console.error("Failed to fetch ingredients:", ingredientsError);
    return NextResponse.json({ error: "Failed to fetch ingredients" }, { status: 500 });
  }

  // Group ingredients by ingredient_id, multiplying quantities by recipe occurrence count
  const ingredientGroups: Record<
    string,
    {
      ingredientId: string;
      ingredientName: string;
      department: string;
      storeId: string | null;
      items: {
        recipeId: string;
        recipeName: string;
        quantity: number | null;
        unit: string | null;
        occurrences: number;
      }[];
    }
  > = {};

  (recipeIngredients || []).forEach((ri) => {
    const ingredient = ri.ingredients as unknown as {
      id: string;
      name: string;
      department: string | null;
      store_id: string | null;
      store: { id: string; name: string } | null;
    };
    if (!ingredient) return;

    const ingredientId = ingredient.id;
    const occurrences = recipeOccurrences[ri.recipe_id]?.count || 1;

    if (!ingredientGroups[ingredientId]) {
      ingredientGroups[ingredientId] = {
        ingredientId,
        ingredientName: ingredient.name,
        department: ingredient.department || "Other",
        storeId: ingredient.store_id,
        items: [],
      };
    }

    ingredientGroups[ingredientId].items.push({
      recipeId: ri.recipe_id,
      recipeName: recipeOccurrences[ri.recipe_id]?.name || "Unknown Recipe",
      quantity: ri.quantity,
      unit: ri.unit,
      occurrences,
    });
  });

  // Build grocery items to insert
  // Note: recipe_breakdown is computed on-the-fly when fetching, not stored in the database
  const groceryItemsToInsert = Object.values(ingredientGroups).map((group) => {
    const aggregated = aggregateQuantities(group.items);

    return {
      grocery_list_id: groceryList.id,
      ingredient_id: group.ingredientId,
      quantity: aggregated.quantity,
      unit: aggregated.unit,
      checked: false,
      added_by: user.id,
    };
  });

  // Insert new grocery items
  if (groceryItemsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("grocery_items")
      .insert(groceryItemsToInsert);

    if (insertError) {
      console.error("Failed to insert grocery items:", insertError);
      return NextResponse.json({ error: "Failed to insert grocery items" }, { status: 500 });
    }
  }

  // Return success - the frontend will refetch the full weekly plan data
  // which includes the computed recipe_breakdown
  return NextResponse.json({
    success: true,
    itemCount: groceryItemsToInsert.length,
  });
}
