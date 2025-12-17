import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(
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

  // Fetch weekly plan with meals
  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plan")
    .select(`
      *,
      meals (
        id,
        day,
        meal_type,
        custom_meal_name,
        is_leftover,
        is_ai_suggested,
        notes,
        assigned_user_id,
        sort_order,
        recipes (
          id,
          name,
          time_rating,
          yields_leftovers
        ),
        assigned_user:users!meals_assigned_user_id_fkey (
          id,
          name,
          email
        )
      )
    `)
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (planError) {
    return NextResponse.json({ error: "Weekly plan not found" }, { status: 404 });
  }

  // Fetch events for this week
  const weekOf = new Date(weeklyPlan.week_of + "T00:00:00");
  const weekEnd = new Date(weekOf);
  weekEnd.setDate(weekOf.getDate() + 7);

  const { data: weekEvents } = await supabase
    .from("events")
    .select("id, title, description, start_time, end_time, all_day, location")
    .eq("household_id", user.household_id)
    .gte("start_time", weekOf.toISOString())
    .lt("start_time", weekEnd.toISOString())
    .order("start_time");

  // Fetch event assignments for this weekly plan
  const { data: eventAssignments } = await supabase
    .from("weekly_plan_event_assignments")
    .select(`
      event_id,
      user:users (
        id,
        name,
        email
      )
    `)
    .eq("weekly_plan_id", params.id);

  // Group event assignments by event_id
  const eventAssignmentsMap = new Map<string, Array<{ id: string; name: string; email: string }>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (eventAssignments || []).forEach((assignment: any) => {
    if (!eventAssignmentsMap.has(assignment.event_id)) {
      eventAssignmentsMap.set(assignment.event_id, []);
    }
    // Supabase returns single-object joins as objects, not arrays
    const user = assignment.user;
    if (user) {
      eventAssignmentsMap.get(assignment.event_id)!.push({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    }
  });

  // Attach assignments to events
  const eventsWithAssignments = (weekEvents || []).map((event) => ({
    ...event,
    assigned_users: eventAssignmentsMap.get(event.id) || [],
  }));

  // Fetch grocery list separately for this weekly plan
  const { data: groceryLists } = await supabase
    .from("grocery_list")
    .select("id, notes")
    .eq("weekly_plan_id", params.id);

  // If there's a grocery list, fetch its items
  let groceryListWithItems = null;
  if (groceryLists && groceryLists.length > 0) {
    const groceryListId = groceryLists[0].id;

    // Fetch grocery items
    const { data: rawGroceryItems } = await supabase
      .from("grocery_items")
      .select("id, quantity, unit, checked, ingredient_id")
      .eq("grocery_list_id", groceryListId);

    // Get recipe IDs from meals for this weekly plan
    const recipeIds = (weeklyPlan.meals || [])
      .filter((m: { recipes?: { id: string } }) => m.recipes?.id)
      .map((m: { recipes: { id: string } }) => m.recipes.id);

    // Fetch recipe_ingredients for recipes in this plan
    let recipeIngredientsMap = new Map<string, Array<{ recipe_id: string; recipe_name: string; quantity: number | null; unit: string | null }>>();
    if (recipeIds.length > 0) {
      const { data: recipeIngredients } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, ingredient_id, quantity, unit")
        .in("recipe_id", recipeIds);

      // Build a map of recipe_id to recipe_name from meals
      const recipeNameMap = new Map<string, string>();
      (weeklyPlan.meals || []).forEach((m: { recipes?: { id: string; name: string } }) => {
        if (m.recipes) {
          recipeNameMap.set(m.recipes.id, m.recipes.name);
        }
      });

      // Group recipe_ingredients by ingredient_id
      (recipeIngredients || []).forEach((ri) => {
        if (!recipeIngredientsMap.has(ri.ingredient_id)) {
          recipeIngredientsMap.set(ri.ingredient_id, []);
        }
        recipeIngredientsMap.get(ri.ingredient_id)!.push({
          recipe_id: ri.recipe_id,
          recipe_name: recipeNameMap.get(ri.recipe_id) || "Unknown Recipe",
          quantity: ri.quantity,
          unit: ri.unit
        });
      });
    }

    // If we have grocery items, fetch their ingredients
    let groceryItems = null;
    if (rawGroceryItems && rawGroceryItems.length > 0) {
      const ingredientIds = rawGroceryItems
        .map(item => item.ingredient_id)
        .filter(Boolean);

      if (ingredientIds.length > 0) {
        // Fetch ingredients with their store info
        const { data: ingredients } = await supabase
          .from("ingredients")
          .select("id, name, department, store_id")
          .in("id", ingredientIds);

        // Get unique store IDs and fetch store names
        const storeIds = (ingredients || [])
          .map(ing => ing.store_id)
          .filter(Boolean);

        let storeMap = new Map<string, string>();
        if (storeIds.length > 0) {
          const { data: stores } = await supabase
            .from("stores")
            .select("id, name")
            .in("id", storeIds);

          storeMap = new Map((stores || []).map(s => [s.id, s.name]));
        }

        // Build a map for quick lookup with store name included
        const ingredientMap = new Map(
          (ingredients || []).map(ing => [ing.id, {
            ...ing,
            store_name: ing.store_id ? storeMap.get(ing.store_id) || null : null
          }])
        );

        // Combine grocery items with their ingredients and recipe breakdown
        groceryItems = rawGroceryItems.map(item => ({
          ...item,
          ingredients: item.ingredient_id ? ingredientMap.get(item.ingredient_id) || null : null,
          recipe_breakdown: item.ingredient_id ? recipeIngredientsMap.get(item.ingredient_id) || [] : []
        }));
      } else {
        groceryItems = rawGroceryItems.map(item => ({
          ...item,
          ingredients: null,
          recipe_breakdown: []
        }));
      }
    }

    groceryListWithItems = {
      ...groceryLists[0],
      grocery_items: groceryItems || [],
    };
  }

  return NextResponse.json({
    weeklyPlan: {
      ...weeklyPlan,
      grocery_list: groceryListWithItems ? [groceryListWithItems] : [],
      events: eventsWithAssignments,
    }
  });
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

  const body = await request.json();

  const { data: weeklyPlan, error: updateError } = await supabase
    .from("weekly_plan")
    .update({
      notes: body.notes,
    })
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update weekly plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ weeklyPlan });
}

export async function DELETE(
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

  const { error: deleteError } = await supabase
    .from("weekly_plan")
    .delete()
    .eq("id", params.id)
    .eq("household_id", user.household_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete weekly plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
