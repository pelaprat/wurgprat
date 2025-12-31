"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatWeekRange, isCurrentWeek } from "@/utils/dates";
import { PageHeaderSkeleton, WeeklyPlanCardSkeleton } from "@/components/Skeleton";

interface Meal {
  id: string;
  day: number;
  meal_type: string;
  recipe?: {
    id: string;
    name: string;
  };
}

interface EventAssignment {
  id: string;
  event_id: string;
}

interface WeeklyPlan {
  id: string;
  week_of: string;
  notes?: string;
  meals: Meal[];
  event_assignments: EventAssignment[];
  created_at: string;
}

export default function WeeklyPlansPage() {
  const { data: session } = useSession();
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchWeeklyPlans();
    }
  }, [session]);

  const fetchWeeklyPlans = async () => {
    try {
      const response = await fetch("/api/weekly-plans");
      if (response.ok) {
        const data = await response.json();
        setWeeklyPlans(data.weeklyPlans || []);
      }
    } catch (error) {
      console.error("Failed to fetch weekly plans:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMealCount = (plan: WeeklyPlan) => {
    return plan.meals?.filter((m) => m.recipe).length || 0;
  };

  const getEventCount = (plan: WeeklyPlan) => {
    // Get unique event IDs since multiple users can be assigned to the same event
    const uniqueEventIds = new Set(plan.event_assignments?.map((ea) => ea.event_id) || []);
    return uniqueEventIds.size;
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view weekly plans.</p>
      </div>
    );
  }

  if (isLoading) {
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
                <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-20 rounded" /></th>
                <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-16 rounded" /></th>
                <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-24 rounded" /></th>
                <th className="px-6 py-3 text-left"><div className="skeleton h-4 w-20 rounded" /></th>
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Weekly Plans</h1>
        <Link
          href="/weekly-plans/create"
          className="inline-flex justify-center px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-center font-medium"
        >
          Create New Plan
        </Link>
      </div>

      {weeklyPlans.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 text-center">
          <p className="text-gray-500 mb-4">No weekly plans yet.</p>
          <Link
            href="/weekly-plans/create"
            className="inline-block px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            Create Your First Plan
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {weeklyPlans.map((plan) => (
              <Link
                key={plan.id}
                href={`/weekly-plans/${plan.id}`}
                className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {formatWeekRange(plan.week_of)}
                      </span>
                      {isCurrentWeek(plan.week_of) && (
                        <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded font-medium">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{getMealCount(plan)}/7 meals</span>
                      <span>{getEventCount(plan)} event{getEventCount(plan) !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Week
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Meals Planned
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {weeklyPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/weekly-plans/${plan.id}`}
                        className="text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {formatWeekRange(plan.week_of)}
                      </Link>
                      {isCurrentWeek(plan.week_of) && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded">
                          Current
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getMealCount(plan)} / 7 dinners
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getEventCount(plan)} event{getEventCount(plan) !== 1 ? "s" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
