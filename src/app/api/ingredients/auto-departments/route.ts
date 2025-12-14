import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderPrompt } from "@/prompts";

const DEPARTMENTS = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Frozen",
  "Pantry",
  "Canned Goods",
  "Condiments & Sauces",
  "Spices & Seasonings",
  "Beverages",
  "Snacks",
  "Deli",
  "International",
  "Baking",
  "Oils & Vinegars",
  "Pasta & Grains",
  "Breakfast",
  "Health & Organic",
];

export async function POST() {
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

  // Get all ingredients without a department
  const { data: ingredients, error: ingredientsError } = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("household_id", user.household_id)
    .is("department", null);

  if (ingredientsError) {
    return NextResponse.json(
      { error: "Failed to fetch ingredients" },
      { status: 500 }
    );
  }

  if (!ingredients || ingredients.length === 0) {
    return NextResponse.json({
      success: true,
      message: "All ingredients already have departments",
      updated: 0,
    });
  }

  // Check for Gemini API key
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Process in batches to be efficient with AI calls
    const ingredientsWithIndex = ingredients.map((i, idx) => ({
      name: i.name,
      index: idx + 1,
    }));

    const prompt = renderPrompt("ingredientDepartmentBatch", {
      ingredients: ingredientsWithIndex,
      departments: DEPARTMENTS,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text().trim();

    // Extract JSON from potential markdown code blocks
    if (responseText.startsWith("```json")) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith("```")) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith("```")) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    let assignments: { name: string; department: string }[];
    try {
      assignments = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Create a map for quick lookup
    const departmentMap = new Map<string, string>();
    for (const assignment of assignments) {
      const validDept = DEPARTMENTS.find(
        (d) => d.toLowerCase() === assignment.department.toLowerCase()
      );
      if (validDept) {
        departmentMap.set(assignment.name.toLowerCase(), validDept);
      }
    }

    // Update each ingredient
    let updated = 0;
    for (const ingredient of ingredients) {
      const department =
        departmentMap.get(ingredient.name.toLowerCase()) || "Pantry";

      const { error: updateError } = await supabase
        .from("ingredients")
        .update({ department })
        .eq("id", ingredient.id);

      if (!updateError) {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Assigned departments to ${updated} ingredient(s)`,
      updated,
      total: ingredients.length,
    });
  } catch (error) {
    console.error("Error auto-assigning departments:", error);
    return NextResponse.json(
      { error: "Failed to auto-assign departments" },
      { status: 500 }
    );
  }
}
