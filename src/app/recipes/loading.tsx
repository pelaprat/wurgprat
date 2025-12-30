import { PageHeaderSkeleton, RecipeCardSkeleton } from "@/components/Skeleton";

export default function RecipesLoading() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeaderSkeleton />

      {/* Search and filters skeleton */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="skeleton h-10 flex-1 rounded-lg" />
        <div className="skeleton h-10 w-32 rounded-lg" />
        <div className="skeleton h-10 w-32 rounded-lg" />
      </div>

      {/* Mobile card view skeleton */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <RecipeCardSkeleton key={i} />
        ))}
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-16 rounded" /></th>
              <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-20 rounded" /></th>
              <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-16 rounded" /></th>
              <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-12 rounded" /></th>
              <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-12 rounded" /></th>
              <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-16 rounded" /></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><div className="skeleton h-4 w-40 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-5 w-16 rounded-full" /></td>
                <td className="px-6 py-4"><div className="skeleton h-5 w-20 rounded-full" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-8 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-8 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-16 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
