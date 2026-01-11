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

/**
 * Get the sort index for a department using a store's custom order
 * Falls back to default order if no custom order is set
 */
export function getDepartmentSortIndexForStore(
  department: string | null | undefined,
  storeOrder: string[] | null | undefined
): number {
  if (!department) return (storeOrder?.length ?? DEPARTMENT_ORDER.length);

  // Use store's custom order if provided
  if (storeOrder && storeOrder.length > 0) {
    const index = storeOrder.indexOf(department);
    return index === -1 ? storeOrder.length : index;
  }

  // Fall back to default order
  return getDepartmentSortIndex(department);
}

export type Department = typeof DEPARTMENT_ORDER[number];
