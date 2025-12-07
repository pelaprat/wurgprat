import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    hasHousehold?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}

export interface Meal {
  id: string;
  name: string;
  description?: string;
  recipe_url?: string;
  ingredients: string[];
  created_by: string;
  created_at: string;
}

export interface MealPlan {
  id: string;
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  meal_id?: string;
  meal?: Meal;
  notes?: string;
  household_id: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
  checked: boolean;
  household_id: string;
  added_by: string;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  created_at: string;
}
