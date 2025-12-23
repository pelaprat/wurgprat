/**
 * Grocery-related constants
 */

/**
 * Standard department order for grocery lists
 * Matches typical grocery store layout
 */
export const DEPARTMENT_ORDER = [
  "Produce",
  "Meat & Seafood",
  "Dairy",
  "Bakery",
  "Frozen",
  "Pantry",
  "Canned Goods",
  "Condiments",
  "Spices",
  "Beverages",
  "Snacks",
  "Other",
] as const;

/**
 * Get the sort index for a department
 * Returns a high number for unknown departments to sort them last
 */
export function getDepartmentSortIndex(department: string | null | undefined): number {
  if (!department) return DEPARTMENT_ORDER.length;
  const index = DEPARTMENT_ORDER.indexOf(department as typeof DEPARTMENT_ORDER[number]);
  return index === -1 ? DEPARTMENT_ORDER.length : index;
}

export type Department = typeof DEPARTMENT_ORDER[number];
