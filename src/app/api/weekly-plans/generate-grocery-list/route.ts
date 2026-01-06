import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

interface ProposedMeal {
  day: number;
  date: string;
  recipeId?: string;
  recipeName: string;
}

interface StapleItemInput {
  id: string;
  ingredientId: string;
  ingredientName: string;
  department: string;
  storeId?: string;
  storeName?: string;
  quantity: string;
  unit: string;
}

interface RecipeIngredient {
  ingredient_id: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  ingredients: {
    id: string;
    name: string;
    department: string | null;
    store_id: string | null;
    store: { id: string; name: string } | null;
  };
}

interface RecipeBreakdown {
  recipeId: string;
  recipeName: string;
  quantity: string;
  unit: string;
}

interface GroceryItemDraft {
  id: string;
  ingredientId: string;
  ingredientName: string;
  department: string;
  storeId?: string;
  storeName?: string;
  totalQuantity: string;
  unit: string;
  recipeBreakdown: RecipeBreakdown[];
  isManualAdd: boolean;
  isStaple: boolean;
  checked: boolean;
}

// Try to aggregate quantities with same unit, accounting for recipe occurrences
function aggregateQuantities(
  items: { quantity: number | null; unit: string | null; occurrences: number }[]
): { quantity: string; unit: string } {
  // Filter to items with quantities
  const withQty = items.filter((i) => i.quantity != null);

  if (withQty.length === 0) {
    // No quantities defined - count total occurrences
    const totalOccurrences = items.reduce((sum, i) => sum + i.occurrences, 0);
    return { quantity: String(totalOccurrences), unit: "" };
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
    // Format nicely - round to 2 decimal places and remove trailing zeros
    const formatted = total % 1 === 0 ? String(total) : parseFloat(total.toFixed(2)).toString();
    return { quantity: formatted, unit };
  }

  // Multiple units - just list them all
  const parts = units.map((unit) => {
    const qty = byUnit[unit];
    const formatted = qty % 1 === 0 ? String(qty) : parseFloat(qty.toFixed(2)).toString();
    return `${formatted}${unit ? ` ${unit}` : ""}`;
  });
  return { quantity: parts.join(" + "), unit: "" };
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
    .select("id, household_id")
    .eq("email", session.user.email)
    .single();

  if (userError || !user?.household_id) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  // Parse request
  const body = await request.json();
  const { meals, stapleItems } = body as {
    meals: ProposedMeal[];
    stapleItems?: StapleItemInput[];
  };

  if (!meals || meals.length === 0) {
    return NextResponse.json({ error: "No meals provided" }, { status: 400 });
  }

  // Get recipe IDs that have actual recipes, counting occurrences for recipes used multiple times
  const recipeOccurrences: Record<string, { count: number; name: string }> = {};
  meals.forEach((meal) => {
    if (meal.recipeId) {
      if (!recipeOccurrences[meal.recipeId]) {
        recipeOccurrences[meal.recipeId] = { count: 0, name: meal.recipeName };
      }
      recipeOccurrences[meal.recipeId].count++;
    }
  });

  const uniqueRecipeIds = Object.keys(recipeOccurrences);

  if (uniqueRecipeIds.length === 0) {
    return NextResponse.json({ groceryItems: [] });
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
    return NextResponse.json(
      { error: "Failed to fetch ingredients" },
      { status: 500 }
    );
  }

  // Group ingredients by ingredient_id, multiplying quantities by recipe occurrence count
  const ingredientGroups: Record<
    string,
    {
      ingredientId: string;
      ingredientName: string;
      department: string;
      storeId?: string;
      storeName?: string;
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
        storeId: ingredient.store_id || undefined,
        storeName: ingredient.store?.name || undefined,
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

  // Build grocery items
  const groceryItems: GroceryItemDraft[] = Object.values(ingredientGroups).map(
    (group) => {
      const aggregated = aggregateQuantities(group.items);

      const recipeBreakdown: RecipeBreakdown[] = group.items.map((item) => {
        // Calculate the total quantity for this recipe (quantity × occurrences)
        const totalQty = item.quantity != null ? item.quantity * item.occurrences : null;
        const formattedQty = totalQty != null
          ? (totalQty % 1 === 0 ? String(totalQty) : parseFloat(totalQty.toFixed(2)).toString())
          : String(item.occurrences);

        // Add occurrence indicator to recipe name if used multiple times
        const recipeName = item.occurrences > 1
          ? `${item.recipeName} (×${item.occurrences})`
          : item.recipeName;

        return {
          recipeId: item.recipeId,
          recipeName,
          quantity: formattedQty,
          unit: item.unit || "",
        };
      });

      return {
        id: `ing-${group.ingredientId}`,
        ingredientId: group.ingredientId,
        ingredientName: group.ingredientName,
        department: group.department,
        storeId: group.storeId,
        storeName: group.storeName,
        totalQuantity: aggregated.quantity,
        unit: aggregated.unit,
        recipeBreakdown,
        isManualAdd: false,
        isStaple: false,
        checked: false,
      };
    }
  );

  // Merge staple items with recipe-based items
  if (stapleItems && stapleItems.length > 0) {
    stapleItems.forEach((staple) => {
      // Find if this ingredient already exists from recipes
      const existingItem = groceryItems.find(
        (item) => item.ingredientId === staple.ingredientId
      );

      if (existingItem) {
        // Merge: combine quantities and mark as staple
        existingItem.isStaple = true;

        // Try to combine quantities if units match
        const existingUnit = existingItem.unit.toLowerCase().trim();
        const stapleUnit = staple.unit.toLowerCase().trim();

        if (existingUnit === stapleUnit || (!existingUnit && !stapleUnit)) {
          // Same unit or both empty - sum the quantities
          const existingQty = parseFloat(existingItem.totalQuantity) || 0;
          const stapleQty = parseFloat(staple.quantity) || 0;
          const combined = existingQty + stapleQty;
          existingItem.totalQuantity =
            combined % 1 === 0
              ? String(combined)
              : parseFloat(combined.toFixed(2)).toString();
        } else {
          // Different units - append staple quantity
          existingItem.totalQuantity = `${existingItem.totalQuantity}${existingItem.unit ? ` ${existingItem.unit}` : ""} + ${staple.quantity}${staple.unit ? ` ${staple.unit}` : ""}`;
          existingItem.unit = "";
        }

        // Add staple to recipe breakdown for transparency
        existingItem.recipeBreakdown.push({
          recipeId: "staple",
          recipeName: "Staple",
          quantity: staple.quantity,
          unit: staple.unit,
        });
      } else {
        // Add as new staple item
        groceryItems.push({
          id: `staple-${staple.ingredientId}`,
          ingredientId: staple.ingredientId,
          ingredientName: staple.ingredientName,
          department: staple.department,
          storeId: staple.storeId,
          storeName: staple.storeName,
          totalQuantity: staple.quantity,
          unit: staple.unit,
          recipeBreakdown: [
            {
              recipeId: "staple",
              recipeName: "Staple",
              quantity: staple.quantity,
              unit: staple.unit,
            },
          ],
          isManualAdd: false,
          isStaple: true,
          checked: false,
        });
      }
    });
  }

  // Sort by department and name
  groceryItems.sort((a, b) => {
    if (a.department !== b.department) {
      return a.department.localeCompare(b.department);
    }
    return a.ingredientName.localeCompare(b.ingredientName);
  });

  return NextResponse.json({ groceryItems });
}
