import { PageHeaderSkeleton, WeeklyPlanCardSkeleton } from "@/components/Skeleton";

export default function WeeklyPlansLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeaderSkeleton />

      {/* Mobile card view skeleton */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <WeeklyPlanCardSkeleton key={i} />
        ))}
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left">
                <div className="skeleton h-4 w-20 rounded" />
              </th>
              <th className="px-6 py-3 text-left">
                <div className="skeleton h-4 w-16 rounded" />
              </th>
              <th className="px-6 py-3 text-left">
                <div className="skeleton h-4 w-24 rounded" />
              </th>
              <th className="px-6 py-3 text-left">
                <div className="skeleton h-4 w-20 rounded" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><div className="skeleton h-4 w-32 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-5 w-16 rounded-full" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-20 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-24 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
