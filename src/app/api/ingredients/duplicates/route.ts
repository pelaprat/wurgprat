import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderPrompt } from "@/prompts";

interface Ingredient {
  id: string;
  name: string;
  department?: string;
}

interface DuplicateGroup {
  ingredients: Ingredient[];
  similarity: string;
}

export async function GET() {
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

  // Get all ingredients for the household
  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, name, department")
    .eq("household_id", user.household_id)
    .order("name");

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch ingredients" },
      { status: 500 }
    );
  }

  if (!ingredients || ingredients.length < 2) {
    return NextResponse.json({
      duplicateGroups: [],
      totalGroups: 0,
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

    // Create a numbered list of ingredients for the prompt
    const ingredientsWithIndex = ingredients.map((ing, i) => ({
      name: ing.name,
      index: i + 1,
    }));

    const prompt = renderPrompt("duplicateDetection", {
      ingredients: ingredientsWithIndex,
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

    let llmGroups: { indices: number[]; reason: string; canonical: string }[];
    try {
      llmGroups = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse LLM response:", responseText);
      return NextResponse.json({
        duplicateGroups: [],
        totalGroups: 0,
        error: "Failed to parse AI response",
      });
    }

    if (!Array.isArray(llmGroups)) {
      return NextResponse.json({
        duplicateGroups: [],
        totalGroups: 0,
      });
    }

    // Convert LLM response to our format
    const duplicateGroups: DuplicateGroup[] = [];

    for (const group of llmGroups) {
      if (!group.indices || group.indices.length < 2) continue;

      const groupIngredients: Ingredient[] = [];
      for (const idx of group.indices) {
        // Convert 1-based index to 0-based
        const ingredient = ingredients[idx - 1];
        if (ingredient) {
          groupIngredients.push(ingredient);
        }
      }

      if (groupIngredients.length >= 2) {
        duplicateGroups.push({
          ingredients: groupIngredients,
          similarity: group.reason || `Variations of "${group.canonical}"`,
        });
      }
    }

    return NextResponse.json({
      duplicateGroups,
      totalGroups: duplicateGroups.length,
    });
  } catch (error) {
    console.error("Error finding duplicates with AI:", error);
    return NextResponse.json(
      { error: "Failed to analyze ingredients" },
      { status: 500 }
    );
  }
}
