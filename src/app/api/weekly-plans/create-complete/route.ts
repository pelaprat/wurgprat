import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

interface ProposedMeal {
  day: number;
  date: string;
  recipeId?: string;
  recipeName: string;
  customMealName?: string;
  isAiSuggested: boolean;
  assignedUserId?: string;
}

interface EventAssignment {
  eventId: string;
  assignedUserIds: string[];
}

interface RecipeBreakdown {
  recipeId: string;
  recipeName: string;
  quantity: string;
  unit: string;
}

interface GroceryItemDraft {
  id: string;
  ingredientId?: string;
  ingredientName: string;
  department: string;
  totalQuantity: string;
  unit: string;
  recipeBreakdown: RecipeBreakdown[];
  isManualAdd: boolean;
  checked: boolean;
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
  const { weekOf, meals, groceryItems, eventAssignments, notes } = body as {
    weekOf: string;
    meals: ProposedMeal[];
    groceryItems: GroceryItemDraft[];
    eventAssignments?: EventAssignment[];
    notes?: string;
  };

  if (!weekOf) {
    return NextResponse.json({ error: "weekOf is required" }, { status: 400 });
  }

  if (!meals || meals.length === 0) {
    return NextResponse.json({ error: "No meals provided" }, { status: 400 });
  }

  // Check if a plan already exists for this week
  const { data: existingPlan } = await supabase
    .from("weekly_plan")
    .select("id")
    .eq("household_id", user.household_id)
    .eq("week_of", weekOf)
    .single();

  if (existingPlan) {
    return NextResponse.json(
      { error: "A plan already exists for this week" },
      { status: 400 }
    );
  }

  // Start transaction-like operations
  try {
    // 1. Create the weekly plan
    const { data: weeklyPlan, error: planError } = await supabase
      .from("weekly_plan")
      .insert({
        household_id: user.household_id,
        week_of: weekOf,
        notes: notes || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (planError || !weeklyPlan) {
      console.error("Failed to create weekly plan:", planError);
      return NextResponse.json(
        { error: "Failed to create weekly plan" },
        { status: 500 }
      );
    }

    // 2. Create meals
    const mealsToInsert = meals.map((meal) => ({
      weekly_plan_id: weeklyPlan.id,
      recipe_id: meal.recipeId || null,
      day: meal.day,
      meal_type: "dinner" as const,
      custom_meal_name: meal.customMealName || null,
      is_ai_suggested: meal.isAiSuggested,
      assigned_user_id: meal.assignedUserId || null,
      created_by: user.id,
    }));

    const { error: mealsError } = await supabase
      .from("meals")
      .insert(mealsToInsert);

    if (mealsError) {
      console.error("Failed to create meals:", mealsError);
      // Try to clean up the weekly plan
      await supabase.from("weekly_plan").delete().eq("id", weeklyPlan.id);
      return NextResponse.json(
        { error: "Failed to create meals" },
        { status: 500 }
      );
    }

    // 3. Create grocery list
    const { data: groceryList, error: groceryListError } = await supabase
      .from("grocery_list")
      .insert({
        weekly_plan_id: weeklyPlan.id,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (groceryListError || !groceryList) {
      console.error("Failed to create grocery list:", groceryListError);
      // Clean up
      await supabase.from("weekly_plan").delete().eq("id", weeklyPlan.id);
      return NextResponse.json(
        { error: "Failed to create grocery list" },
        { status: 500 }
      );
    }

    // 4. Create grocery items
    if (groceryItems && groceryItems.length > 0) {
      // For manual adds without ingredient_id, we need to create or find the ingredient first
      const itemsToInsert = [];

      for (const item of groceryItems) {
        let ingredientId = item.ingredientId;

        // If no ingredient_id (manual add), find or create the ingredient
        if (!ingredientId) {
          // Try to find existing ingredient
          const { data: existingIngredient } = await supabase
            .from("ingredients")
            .select("id")
            .eq("household_id", user.household_id)
            .ilike("name", item.ingredientName)
            .single();

          if (existingIngredient) {
            ingredientId = existingIngredient.id;
          } else {
            // Create new ingredient
            const { data: newIngredient } = await supabase
              .from("ingredients")
              .insert({
                household_id: user.household_id,
                name: item.ingredientName.toLowerCase(),
                department: item.department,
              })
              .select("id")
              .single();

            if (newIngredient) {
              ingredientId = newIngredient.id;
            }
          }
        }

        if (ingredientId) {
          // Parse quantity to number
          let quantity: number | null = null;
          const qtyStr = item.totalQuantity;
          if (qtyStr) {
            const parsed = parseFloat(qtyStr);
            if (!isNaN(parsed)) {
              quantity = parsed;
            }
          }

          itemsToInsert.push({
            grocery_list_id: groceryList.id,
            ingredient_id: ingredientId,
            quantity,
            unit: item.unit || null,
            checked: false,
            added_by: user.id,
          });
        }
      }

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("grocery_items")
          .insert(itemsToInsert);

        if (itemsError) {
          console.error("Failed to create grocery items:", itemsError);
          // Don't fail the whole operation, grocery items are secondary
        }
      }
    }

    // 5. Create event assignments
    if (eventAssignments && eventAssignments.length > 0) {
      const assignmentsToInsert: Array<{
        weekly_plan_id: string;
        event_id: string;
        user_id: string;
      }> = [];

      for (const assignment of eventAssignments) {
        for (const userId of assignment.assignedUserIds) {
          assignmentsToInsert.push({
            weekly_plan_id: weeklyPlan.id,
            event_id: assignment.eventId,
            user_id: userId,
          });
        }
      }

      if (assignmentsToInsert.length > 0) {
        const { error: assignmentsError } = await supabase
          .from("weekly_plan_event_assignments")
          .insert(assignmentsToInsert);

        if (assignmentsError) {
          console.error("Failed to create event assignments:", assignmentsError);
          // Don't fail the whole operation, event assignments are secondary
        }
      }
    }

    return NextResponse.json({
      weeklyPlanId: weeklyPlan.id,
      groceryListId: groceryList.id,
      mealCount: meals.length,
      itemCount: groceryItems?.length || 0,
      eventAssignmentCount: eventAssignments?.length || 0,
    });
  } catch (error) {
    console.error("Error creating weekly plan:", error);
    return NextResponse.json(
      { error: "Failed to create weekly plan" },
      { status: 500 }
    );
  }
}
