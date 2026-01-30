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

export interface Kid {
  id: string;
  household_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  birth_date?: string;
  allowance_balance: number;
  prat_points: number;
  created_at: string;
  updated_at: string;
  // Populated when fetching with splits
  allowance_splits?: AllowanceSplit[];
}

export interface AllowanceSplit {
  id: string;
  kid_id: string;
  split_key: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface AllowanceTransaction {
  id: string;
  kid_id: string;
  split_key: string;
  amount: number;
  transaction_type: 'deposit' | 'withdrawal';
  description?: string;
  created_by?: string;
  created_at: string;
  // Populated when joining with users
  created_by_name?: string;
}

export interface AllowanceSplitConfig {
  key: string;
  name: string;
  percentage: number;
}
