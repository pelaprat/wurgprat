/**
 * Skeleton loading components for native-app-like loading states.
 * These replace generic spinners with content-shaped placeholders.
 */

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton element with shimmer animation
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`skeleton rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton for a card item (used in lists)
 */
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="flex gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/**
 * Skeleton for a list of cards
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for recipe cards
 */
export function RecipeCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 animate-fadeIn">
      <div className="flex items-start justify-between mb-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-2/3 mb-3" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Skeleton for weekly plan cards
 */
export function WeeklyPlanCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for table rows
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-4 ${i === 0 ? "w-32" : "w-20"}`} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton for ingredient list items
 */
export function IngredientCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton for page headers
 */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fadeIn">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

/**
 * Full page skeleton with header and list
 */
export function PageSkeleton({ itemCount = 5 }: { itemCount?: number }) {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeaderSkeleton />
      <ListSkeleton count={itemCount} />
    </div>
  );
}
