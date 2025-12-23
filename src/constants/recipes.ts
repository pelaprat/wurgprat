/**
 * Recipe-related constants
 */

/**
 * Time rating labels for recipes (1-5 scale)
 */
export const TIME_RATING_LABELS: Record<number, string> = {
  1: "Very Quick",
  2: "Quick",
  3: "Medium",
  4: "Long",
  5: "Very Long",
};

/**
 * Time rating colors for visual display
 */
export const TIME_RATING_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-lime-100 text-lime-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-orange-100 text-orange-800",
  5: "bg-red-100 text-red-800",
};

/**
 * Valid recipe categories
 */
export const RECIPE_CATEGORIES = [
  "entree",
  "side",
  "dessert",
  "appetizer",
  "breakfast",
  "soup",
  "salad",
  "beverage",
] as const;

/**
 * Recipe status options
 */
export const RECIPE_STATUSES = [
  "active",
  "wishlist",
  "archived",
] as const;

export type RecipeCategory = typeof RECIPE_CATEGORIES[number];
export type RecipeStatus = typeof RECIPE_STATUSES[number];
