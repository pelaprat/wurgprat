"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";

interface Meal {
  id: string;
  day: number;
  meal_type: string;
  recipe: {
    id: string;
    name: string;
  } | null;
}

interface WeeklyPlan {
  id: string;
  week_of: string;
  meals: Meal[];
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
}

interface TodayInfo {
  weeklyPlan: WeeklyPlan | null;
  dayOfWeek: number;
  meals: Meal[];
  events: CalendarEvent[];
}

function HomeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notification, setNotification] = useState<string | null>(null);
  const [todayInfo, setTodayInfo] = useState<TodayInfo | null>(null);
  const [isLoadingToday, setIsLoadingToday] = useState(true);

  // Memoize today's date to prevent infinite re-renders
  const [today] = useState(() => new Date());
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    if (session && session.hasHousehold === false) {
      router.push("/onboarding");
    }
  }, [session, router]);

  // Handle notification from query params
  useEffect(() => {
    const notificationType = searchParams.get("notification");
    if (notificationType === "weekly-plan-created") {
      setNotification("Your weekly plan was created.");
      router.replace("/", { scroll: false });
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  // Fetch today's data - only run once when session is available
  useEffect(() => {
    if (!session) return;

    const fetchTodayInfo = async () => {
      setIsLoadingToday(true);
      try {
        // Fetch weekly plans and events in parallel
        const [plansRes, eventsRes] = await Promise.all([
          fetch("/api/weekly-plans"),
          fetch("/api/events?days=1"),
        ]);

        let currentPlan: WeeklyPlan | null = null;
        let dayOfWeek = 1;
        let todayMeals: Meal[] = [];

        if (plansRes.ok) {
          const plansData = await plansRes.json();
          const weeklyPlans: WeeklyPlan[] = plansData.weeklyPlans || [];

          // Find a plan that contains today's date
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);

          for (const plan of weeklyPlans) {
            const weekStart = new Date(plan.week_of + "T00:00:00");
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            if (todayDate >= weekStart && todayDate < weekEnd) {
              currentPlan = plan;
              // Calculate day of week (1-7, where 1 is the first day of the plan week)
              const diffTime = todayDate.getTime() - weekStart.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              dayOfWeek = diffDays + 1;

              // Get meals for today
              todayMeals = (plan.meals || []).filter(
                (meal: Meal) => meal.day === dayOfWeek
              );
              break;
            }
          }
        }

        // Get today's events
        let todayEvents: CalendarEvent[] = [];
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          const events: CalendarEvent[] = eventsData.events || [];

          // Filter to only today's events
          const todayStr = today.toISOString().split("T")[0];
          todayEvents = events.filter((event) => {
            const eventDate = event.start_time?.split("T")[0];
            return eventDate === todayStr;
          });
        }

        setTodayInfo({
          weeklyPlan: currentPlan,
          dayOfWeek,
          meals: todayMeals,
          events: todayEvents,
        });
      } catch (error) {
        console.error("Failed to fetch today info:", error);
      } finally {
        setIsLoadingToday(false);
      }
    };

    fetchTodayInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Plan Meals Together
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          A simple way for you and your partner to plan weekly meals,
          manage recipes, and build grocery lists — synced with Google Calendar.
        </p>
        <button
          onClick={() => signIn("google")}
          className="bg-emerald-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-emerald-700 transition-colors inline-flex items-center space-x-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Get Started with Google</span>
        </button>

        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="text-3xl mb-3">📅</div>
            <h3 className="font-semibold text-lg mb-2">Weekly Planning</h3>
            <p className="text-gray-600">
              Plan breakfast, lunch, and dinner for the whole week at a glance.
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="text-3xl mb-3">🛒</div>
            <h3 className="font-semibold text-lg mb-2">Smart Grocery Lists</h3>
            <p className="text-gray-600">
              Auto-generate shopping lists from your meal plan.
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="text-3xl mb-3">🔄</div>
            <h3 className="font-semibold text-lg mb-2">Calendar Sync</h3>
            <p className="text-gray-600">
              Meals appear in Google Calendar so you never forget.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dinnerMeals = todayInfo?.meals.filter((m) => m.meal_type === "dinner") || [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{notification}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 hover:bg-emerald-700 rounded p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Today's Date Section - Hero */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl shadow-lg p-8 mb-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          {formattedDate}
        </h1>

        {isLoadingToday ? (
          <div className="flex items-center gap-2 text-emerald-100 mt-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Loading...</span>
          </div>
        ) : todayInfo?.weeklyPlan ? (
          <div className="mt-3">
            <p className="text-emerald-100 text-lg">
              You have a meal plan for this week.
            </p>
            <div className="flex gap-4 mt-4">
              <Link
                href={`/weekly-plans/${todayInfo.weeklyPlan.id}?tab=dinner`}
                className="bg-white/20 hover:bg-white/30 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                View Dinner Plan
              </Link>
              <Link
                href={`/weekly-plans/${todayInfo.weeklyPlan.id}?tab=grocery`}
                className="bg-white/20 hover:bg-white/30 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                View Grocery List
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-emerald-100 mt-2 text-lg">
            No meal plan for this week.{" "}
            <Link href="/weekly-plans/create" className="text-white underline hover:no-underline font-medium">
              Create one
            </Link>
          </p>
        )}
      </div>

      {/* Today's Info Section */}
      {!isLoadingToday && todayInfo && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Tonight's Dinner */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Tonight&apos;s Dinner</h2>
            </div>
            {dinnerMeals.length > 0 ? (
              <ul className="space-y-3">
                {dinnerMeals.map((meal) => (
                  <li key={meal.id} className="text-lg">
                    {meal.recipe ? (
                      <Link
                        href={`/recipes/${meal.recipe.id}`}
                        className="text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {meal.recipe.name}
                      </Link>
                    ) : (
                      <span className="text-gray-500">No recipe assigned</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : todayInfo.weeklyPlan ? (
              <p className="text-gray-500 text-lg">No dinner planned for today.</p>
            ) : (
              <p className="text-gray-500">Create a meal plan to see tonight&apos;s dinner.</p>
            )}
          </div>

          {/* Today's Activities */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Today&apos;s Activities</h2>
            </div>
            {todayInfo.events.length > 0 ? (
              <ul className="space-y-3">
                {todayInfo.events.map((event) => (
                  <li key={event.id} className="flex items-start gap-3">
                    <span className="text-gray-400 text-sm whitespace-nowrap min-w-[60px]">
                      {event.all_day
                        ? "All day"
                        : new Date(event.start_time).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </span>
                    <span className="text-gray-900">{event.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No activities scheduled for today.</p>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions - Subdued */}
      <div className="border-t border-gray-200 pt-6 mt-2">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-4">
          <Link
            href="/weekly-plans/create"
            className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group text-center"
          >
            <div className="text-2xl mb-2">📅</div>
            <h3 className="text-sm font-medium text-gray-700 group-hover:text-emerald-600">
              Create Plan
            </h3>
          </Link>

          <Link
            href="/weekly-plans"
            className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group text-center"
          >
            <div className="text-2xl mb-2">📋</div>
            <h3 className="text-sm font-medium text-gray-700 group-hover:text-emerald-600">
              Weekly Plans
            </h3>
          </Link>

          <Link
            href="/recipes"
            className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group text-center"
          >
            <div className="text-2xl mb-2">📖</div>
            <h3 className="text-sm font-medium text-gray-700 group-hover:text-emerald-600">
              Recipes
            </h3>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
