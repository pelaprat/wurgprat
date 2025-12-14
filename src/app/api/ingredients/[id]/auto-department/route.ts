import { NextRequest, NextResponse } from "next/server";
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

export async function POST(
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

  // Get the ingredient
  const { data: ingredient, error: ingredientError } = await supabase
    .from("ingredients")
    .select("id, name, department")
    .eq("id", params.id)
    .eq("household_id", user.household_id)
    .single();

  if (ingredientError || !ingredient) {
    return NextResponse.json(
      { error: "Ingredient not found" },
      { status: 404 }
    );
  }

  // If department already exists, return it
  if (ingredient.department) {
    return NextResponse.json({
      department: ingredient.department,
      alreadySet: true,
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
    // Use Gemini to determine the department
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = renderPrompt("ingredientDepartmentSingle", {
      ingredientName: ingredient.name,
      departments: DEPARTMENTS,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const department = response.text().trim();

    // Validate the response is one of our departments
    const validDepartment = DEPARTMENTS.find(
      (d) => d.toLowerCase() === department.toLowerCase()
    );

    if (!validDepartment) {
      // Default to Pantry if AI returns invalid department
      const fallbackDepartment = "Pantry";
      await supabase
        .from("ingredients")
        .update({ department: fallbackDepartment })
        .eq("id", params.id);

      return NextResponse.json({
        department: fallbackDepartment,
        alreadySet: false,
      });
    }

    // Update the ingredient with the determined department
    const { error: updateError } = await supabase
      .from("ingredients")
      .update({ department: validDepartment })
      .eq("id", params.id);

    if (updateError) {
      console.error("Failed to update department:", updateError);
      return NextResponse.json(
        { error: "Failed to update department" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      department: validDepartment,
      alreadySet: false,
    });
  } catch (error) {
    console.error("Error determining department:", error);
    return NextResponse.json(
      { error: "Failed to determine department" },
      { status: 500 }
    );
  }
}
