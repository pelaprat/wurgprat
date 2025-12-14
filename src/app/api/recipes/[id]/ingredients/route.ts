import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

interface IngredientUpdate {
  id: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  sort_order?: number;
  ingredient: {
    id: string;
    name: string;
  };
}

export async function PUT(
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

  // Verify the recipe belongs to the household
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const body = await request.json();
  const { ingredients } = body as { ingredients: IngredientUpdate[] };

  if (!Array.isArray(ingredients)) {
    return NextResponse.json(
      { error: "Invalid ingredients data" },
      { status: 400 }
    );
  }

  try {
    // Delete all existing recipe ingredients
    await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("recipe_id", params.id);

    // Insert updated ingredients
    if (ingredients.length > 0) {
      const recipeIngredients = ingredients.map((ing, index) => ({
        recipe_id: params.id,
        ingredient_id: ing.ingredient.id,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes,
        sort_order: ing.sort_order ?? index,
      }));

      const { error: insertError } = await supabase
        .from("recipe_ingredients")
        .insert(recipeIngredients);

      if (insertError) {
        console.error("Failed to insert recipe ingredients:", insertError);
        return NextResponse.json(
          { error: "Failed to save ingredients" },
          { status: 500 }
        );
      }
    }

    // Return updated ingredients
    const { data: savedIngredients } = await supabase
      .from("recipe_ingredients")
      .select(
        `
        id,
        quantity,
        unit,
        notes,
        sort_order,
        ingredient:ingredients(id, name, department)
      `
      )
      .eq("recipe_id", params.id)
      .order("sort_order");

    return NextResponse.json({
      success: true,
      ingredients: savedIngredients,
    });
  } catch (error) {
    console.error("Error updating ingredients:", error);
    return NextResponse.json(
      { error: "Failed to update ingredients" },
      { status: 500 }
    );
  }
}
