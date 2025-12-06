"use client";

import { useSession, signIn } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();

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

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Welcome back, {session.user?.name?.split(" ")[0]}!
      </h1>
      <p className="text-gray-600 mb-8">What would you like to do today?</p>

      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href="/meals"
          className="p-6 bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-emerald-500 transition-colors group"
        >
          <div className="text-4xl mb-4">📅</div>
          <h2 className="text-xl font-semibold mb-2 group-hover:text-emerald-600">
            Plan This Week
          </h2>
          <p className="text-gray-600">
            View and edit your meal plan for the current week.
          </p>
        </Link>

        <Link
          href="/recipes"
          className="p-6 bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-emerald-500 transition-colors group"
        >
          <div className="text-4xl mb-4">📖</div>
          <h2 className="text-xl font-semibold mb-2 group-hover:text-emerald-600">
            Browse Recipes
          </h2>
          <p className="text-gray-600">
            View your saved recipes or add new favorites.
          </p>
        </Link>

        <Link
          href="/groceries"
          className="p-6 bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-emerald-500 transition-colors group"
        >
          <div className="text-4xl mb-4">🛒</div>
          <h2 className="text-xl font-semibold mb-2 group-hover:text-emerald-600">
            Grocery List
          </h2>
          <p className="text-gray-600">
            Check your shopping list and mark items as bought.
          </p>
        </Link>

        <Link
          href="/settings"
          className="p-6 bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-emerald-500 transition-colors group"
        >
          <div className="text-4xl mb-4">⚙️</div>
          <h2 className="text-xl font-semibold mb-2 group-hover:text-emerald-600">
            Settings
          </h2>
          <p className="text-gray-600">
            Manage your household and preferences.
          </p>
        </Link>
      </div>
    </div>
  );
}
