import { PageHeaderSkeleton, IngredientCardSkeleton } from "@/components/Skeleton";

export default function IngredientsLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeaderSkeleton />

      {/* Search and filters skeleton */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="skeleton h-10 flex-1 rounded-lg" />
        <div className="skeleton h-10 w-36 rounded-lg" />
        <div className="skeleton h-10 w-36 rounded-lg" />
      </div>

      {/* Ingredient list skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <IngredientCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
