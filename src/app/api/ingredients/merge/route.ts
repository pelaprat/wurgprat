import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { keepId, deleteIds } = body as { keepId: string; deleteIds: string[] };

  if (!keepId || !deleteIds || !Array.isArray(deleteIds) || deleteIds.length === 0) {
    return NextResponse.json(
      { error: "keepId and deleteIds are required" },
      { status: 400 }
    );
  }

  // Make sure keepId is not in deleteIds
  if (deleteIds.includes(keepId)) {
    return NextResponse.json(
      { error: "keepId cannot be in deleteIds" },
      { status: 400 }
    );
  }

  // Verify all ingredients belong to the household
  const allIds = [keepId, ...deleteIds];
  const { data: ingredients, error: ingredientsError } = await supabase
    .from("ingredients")
    .select("id")
    .eq("household_id", user.household_id)
    .in("id", allIds);

  if (ingredientsError || !ingredients || ingredients.length !== allIds.length) {
    return NextResponse.json(
      { error: "One or more ingredients not found or not in your household" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Update all recipe_ingredients to point to the kept ingredient
    // We need to handle potential duplicates - if a recipe already has the keepId ingredient,
    // we should delete the duplicate references instead of updating them

    // First, find recipe_ingredients that use the ingredients being deleted
    const { data: recipeIngsToUpdate, error: fetchError } = await supabase
      .from("recipe_ingredients")
      .select("id, recipe_id, ingredient_id")
      .in("ingredient_id", deleteIds);

    if (fetchError) {
      console.error("Failed to fetch recipe_ingredients:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch relationships" },
        { status: 500 }
      );
    }

    // Find which recipes already have the keepId ingredient
    const { data: existingKeepRecipes } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id")
      .eq("ingredient_id", keepId);

    const recipesWithKeep = new Set(existingKeepRecipes?.map(r => r.recipe_id) || []);

    // Separate into records to update vs records to delete (to avoid duplicates)
    const recordsToUpdate: string[] = [];
    const recordsToDelete: string[] = [];

    for (const ri of recipeIngsToUpdate || []) {
      if (recipesWithKeep.has(ri.recipe_id)) {
        // Recipe already has the kept ingredient, delete this duplicate reference
        recordsToDelete.push(ri.id);
      } else {
        // Safe to update
        recordsToUpdate.push(ri.id);
        // Mark this recipe as now having the kept ingredient
        recipesWithKeep.add(ri.recipe_id);
      }
    }

    // Update records that can be updated
    if (recordsToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from("recipe_ingredients")
        .update({ ingredient_id: keepId })
        .in("id", recordsToUpdate);

      if (updateError) {
        console.error("Failed to update recipe_ingredients:", updateError);
        return NextResponse.json(
          { error: "Failed to update relationships" },
          { status: 500 }
        );
      }
    }

    // Delete records that would cause duplicates
    if (recordsToDelete.length > 0) {
      const { error: deleteRIError } = await supabase
        .from("recipe_ingredients")
        .delete()
        .in("id", recordsToDelete);

      if (deleteRIError) {
        console.error("Failed to delete duplicate recipe_ingredients:", deleteRIError);
        return NextResponse.json(
          { error: "Failed to remove duplicate relationships" },
          { status: 500 }
        );
      }
    }

    // Step 2: Check for grocery_items that reference the deleted ingredients
    // and update them to reference the kept ingredient
    const { data: groceryItemsToUpdate } = await supabase
      .from("grocery_items")
      .select("id")
      .in("ingredient_id", deleteIds);

    if (groceryItemsToUpdate && groceryItemsToUpdate.length > 0) {
      const { error: groceryUpdateError } = await supabase
        .from("grocery_items")
        .update({ ingredient_id: keepId })
        .in("ingredient_id", deleteIds);

      if (groceryUpdateError) {
        console.error("Failed to update grocery_items:", groceryUpdateError);
        // Continue anyway - relationships are more important
      }
    }

    // Step 3: Delete the duplicate ingredients
    const { error: deleteError } = await supabase
      .from("ingredients")
      .delete()
      .in("id", deleteIds);

    if (deleteError) {
      console.error("Failed to delete duplicate ingredients:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete duplicate ingredients" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Merged ${deleteIds.length} duplicate(s) into the selected ingredient`,
      updatedRecipeIngredients: recordsToUpdate.length,
      deletedDuplicateReferences: recordsToDelete.length,
      deletedIngredients: deleteIds.length,
    });
  } catch (error) {
    console.error("Error merging ingredients:", error);
    return NextResponse.json(
      { error: "Failed to merge ingredients" },
      { status: 500 }
    );
  }
}
