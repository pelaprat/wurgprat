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

interface RecipeIngredient {
  ingredient_id: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  ingredients: {
    id: string;
    name: string;
    department: string | null;
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
  totalQuantity: string;
  unit: string;
  recipeBreakdown: RecipeBreakdown[];
  isManualAdd: boolean;
  checked: boolean;
}

// Try to aggregate quantities with same unit
function aggregateQuantities(
  items: { quantity: number | null; unit: string | null }[]
): { quantity: string; unit: string } {
  // Filter to items with quantities
  const withQty = items.filter((i) => i.quantity != null);

  if (withQty.length === 0) {
    return { quantity: String(items.length), unit: "" };
  }

  // Group by unit
  const byUnit: Record<string, number> = {};
  withQty.forEach((item) => {
    const unit = (item.unit || "").toLowerCase().trim();
    byUnit[unit] = (byUnit[unit] || 0) + (item.quantity || 0);
  });

  // If all same unit, sum them
  const units = Object.keys(byUnit);
  if (units.length === 1) {
    const unit = units[0];
    const total = byUnit[unit];
    // Format nicely
    const formatted = total % 1 === 0 ? String(total) : total.toFixed(2);
    return { quantity: formatted, unit };
  }

  // Multiple units - just list them all
  const parts = units.map((unit) => {
    const qty = byUnit[unit];
    const formatted = qty % 1 === 0 ? String(qty) : qty.toFixed(2);
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
  const { meals } = body as { meals: ProposedMeal[] };

  if (!meals || meals.length === 0) {
    return NextResponse.json({ error: "No meals provided" }, { status: 400 });
  }

  // Get recipe IDs that have actual recipes
  const recipeIds = meals
    .filter((m) => m.recipeId)
    .map((m) => m.recipeId as string);

  if (recipeIds.length === 0) {
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
        department
      )
    `)
    .in("recipe_id", recipeIds);

  if (ingredientsError) {
    console.error("Failed to fetch ingredients:", ingredientsError);
    return NextResponse.json(
      { error: "Failed to fetch ingredients" },
      { status: 500 }
    );
  }

  // Create a map of recipe_id to recipe name
  const recipeNameMap: Record<string, string> = {};
  meals.forEach((meal) => {
    if (meal.recipeId) {
      recipeNameMap[meal.recipeId] = meal.recipeName;
    }
  });

  // Group ingredients by ingredient_id
  const ingredientGroups: Record<
    string,
    {
      ingredientId: string;
      ingredientName: string;
      department: string;
      items: {
        recipeId: string;
        recipeName: string;
        quantity: number | null;
        unit: string | null;
      }[];
    }
  > = {};

  (recipeIngredients || []).forEach((ri) => {
    const ingredient = ri.ingredients as unknown as {
      id: string;
      name: string;
      department: string | null;
    };
    if (!ingredient) return;

    const ingredientId = ingredient.id;

    if (!ingredientGroups[ingredientId]) {
      ingredientGroups[ingredientId] = {
        ingredientId,
        ingredientName: ingredient.name,
        department: ingredient.department || "Other",
        items: [],
      };
    }

    ingredientGroups[ingredientId].items.push({
      recipeId: ri.recipe_id,
      recipeName: recipeNameMap[ri.recipe_id] || "Unknown Recipe",
      quantity: ri.quantity,
      unit: ri.unit,
    });
  });

  // Build grocery items
  const groceryItems: GroceryItemDraft[] = Object.values(ingredientGroups).map(
    (group) => {
      const aggregated = aggregateQuantities(group.items);

      const recipeBreakdown: RecipeBreakdown[] = group.items.map((item) => ({
        recipeId: item.recipeId,
        recipeName: item.recipeName,
        quantity:
          item.quantity != null
            ? item.quantity % 1 === 0
              ? String(item.quantity)
              : item.quantity.toFixed(2)
            : "1",
        unit: item.unit || "",
      }));

      return {
        id: `ing-${group.ingredientId}`,
        ingredientId: group.ingredientId,
        ingredientName: group.ingredientName,
        department: group.department,
        totalQuantity: aggregated.quantity,
        unit: aggregated.unit,
        recipeBreakdown,
        isManualAdd: false,
        checked: false,
      };
    }
  );

  // Sort by department and name
  groceryItems.sort((a, b) => {
    if (a.department !== b.department) {
      return a.department.localeCompare(b.department);
    }
    return a.ingredientName.localeCompare(b.ingredientName);
  });

  return NextResponse.json({ groceryItems });
}
