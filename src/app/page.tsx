"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";

interface Recipe {
  id: string;
  name: string;
}

interface AssignedUser {
  id: string;
  name: string;
}

interface Meal {
  id: string;
  day: number;
  meal_type: string;
  custom_meal_name?: string;
  assigned_user_id?: string;
  assigned_user?: AssignedUser;
  recipe: Recipe | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
}

interface Responsibility {
  cooking: { id: string; name: string; meal_type: string }[];
  events: { id: string; title: string; start_time: string; all_day: boolean }[];
}

interface TodayData {
  user: {
    id: string;
    name: string;
    firstName: string;
    email: string;
  };
  today: string;
  weeklyPlan: {
    id: string;
    week_of: string;
  } | null;
  dayOfWeek: number;
  meals: Meal[];
  events: CalendarEvent[];
  responsibilities: Responsibility;
}

function HomeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notification, setNotification] = useState<string | null>(null);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [today] = useState(() => new Date());

  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = today.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  useEffect(() => {
    if (session && session.hasHousehold === false) {
      router.push("/onboarding");
    }
  }, [session, router]);

  useEffect(() => {
    const notificationType = searchParams.get("notification");
    if (notificationType === "weekly-plan-created") {
      setNotification("Your weekly plan was created.");
      router.replace("/", { scroll: false });
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!session) return;

    const fetchTodayData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/today");
        if (response.ok) {
          const data = await response.json();
          setTodayData(data);
        }
      } catch (error) {
        console.error("Failed to fetch today data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTodayData();
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
          Manage the house
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          A simple way to manage our house&apos;s weekly meal plans,
          calendar, and other activities
        </p>
        <button
          onClick={() => signIn("google")}
          className="bg-emerald-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-emerald-700 active:scale-95 transition-all duration-150 ease-spring inline-flex items-center space-x-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>Get Started with Google</span>
        </button>

        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">📅</div>
            <h3 className="font-semibold text-lg mb-2">Weekly Planning</h3>
            <p className="text-gray-600">Plan meals for the whole week at a glance.</p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">🛒</div>
            <h3 className="font-semibold text-lg mb-2">Smart Grocery Lists</h3>
            <p className="text-gray-600">Auto-generate shopping lists from your meal plan.</p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">👨‍👩‍👧‍👦</div>
            <h3 className="font-semibold text-lg mb-2">Family Coordination</h3>
            <p className="text-gray-600">Assign cooking duties and track who&apos;s doing what.</p>
          </div>
        </div>
      </div>
    );
  }

  const dinnerMeals = todayData?.meals.filter((m) => m.meal_type === "dinner") || [];
  const userIsCooking = todayData?.responsibilities.cooking && todayData.responsibilities.cooking.length > 0;
  const userHasEvents = todayData?.responsibilities.events && todayData.responsibilities.events.length > 0;
  const hasResponsibilities = userIsCooking || userHasEvents;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{notification}</span>
            <button onClick={() => setNotification(null)} className="ml-2 hover:bg-emerald-700 rounded p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-baseline justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                Hi {todayData?.user.firstName || "there"}
              </h1>
              <span className="text-gray-500">{dayName}, {monthDay}</span>
            </div>
          </div>

          {/* Your Responsibilities - Only show if user has tasks */}
          {hasResponsibilities && (
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
              <h2 className="text-sm font-medium text-emerald-100 uppercase tracking-wide mb-3">Your tasks today</h2>
              <div className="space-y-3">
                {userIsCooking && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-lg">
                        Cook {todayData!.responsibilities.cooking.map(m => m.name).join(" & ")}
                      </div>
                      <div className="text-emerald-100 text-sm">Tonight&apos;s dinner</div>
                    </div>
                  </div>
                )}
                {userHasEvents && todayData!.responsibilities.events.map((event) => (
                  <div key={event.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{event.title}</div>
                      <div className="text-emerald-100 text-sm">
                        {event.all_day ? "All day" : new Date(event.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="space-y-4">
            {/* Tonight's Dinner */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Tonight&apos;s Dinner</h2>
                {todayData?.weeklyPlan && (
                  <Link
                    href={`/weekly-plans/${todayData.weeklyPlan.id}?tab=dinner`}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    View week
                  </Link>
                )}
              </div>
              <div className="p-5">
                {dinnerMeals.length > 0 ? (
                  <div className="space-y-3">
                    {dinnerMeals.map((meal) => {
                      const isUserCooking = meal.assigned_user_id === todayData?.user.id;
                      const mealName = meal.recipe?.name || meal.custom_meal_name;

                      return (
                        <div key={meal.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {meal.recipe ? (
                              <Link
                                href={`/recipes/${meal.recipe.id}`}
                                className="text-lg font-medium text-gray-900 hover:text-emerald-600 transition-colors"
                              >
                                {mealName}
                              </Link>
                            ) : (
                              <span className="text-lg font-medium text-gray-900">{mealName || "No meal set"}</span>
                            )}
                          </div>
                          {meal.assigned_user && (
                            <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${
                              isUserCooking
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-600"
                            }`}>
                              {isUserCooking ? "You" : meal.assigned_user.name?.split(" ")[0]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : todayData?.weeklyPlan ? (
                  <p className="text-gray-500">No dinner planned for tonight.</p>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 mb-3">No meal plan for this week.</p>
                    <Link
                      href="/weekly-plans/create"
                      className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create a plan
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Today's Schedule */}
            {todayData && todayData.events.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Today&apos;s Schedule</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {todayData.events.map((event) => {
                    const isUserResponsible = todayData.responsibilities.events.some(e => e.id === event.id);

                    return (
                      <div
                        key={event.id}
                        className={`px-5 py-3 flex items-center gap-4 ${isUserResponsible ? "bg-amber-50" : ""}`}
                      >
                        <div className="w-16 text-sm text-gray-500 flex-shrink-0">
                          {event.all_day
                            ? "All day"
                            : new Date(event.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{event.title}</div>
                          {event.location && (
                            <div className="text-sm text-gray-500 truncate">{event.location}</div>
                          )}
                        </div>
                        {isUserResponsible && (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium flex-shrink-0">
                            You
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grocery List Quick Access */}
            {todayData?.weeklyPlan && (
              <Link
                href={`/weekly-plans/${todayData.weeklyPlan.id}?tab=grocery`}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-emerald-300 hover:bg-emerald-50/50 active:scale-[0.98] transition-all duration-150 ease-spring group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900">Grocery List</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>

          {/* Quick Actions Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-6">
              <Link
                href="/weekly-plans/create"
                className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 active:scale-95 transition-all duration-150 ease-spring p-2 -m-2 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">New Plan</span>
              </Link>
              <Link
                href="/weekly-plans"
                className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 active:scale-95 transition-all duration-150 ease-spring p-2 -m-2 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium">All Plans</span>
              </Link>
              <Link
                href="/recipes"
                className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 active:scale-95 transition-all duration-150 ease-spring p-2 -m-2 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-sm font-medium">Recipes</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
