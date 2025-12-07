"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Navigation() {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-emerald-600">
              🍽️ Meal Planner
            </Link>
            {session && (
              <div className="hidden md:flex space-x-6">
                <Link
                  href="/meals"
                  className="text-gray-600 hover:text-emerald-600 transition-colors"
                >
                  This Week
                </Link>
                <Link
                  href="/recipes"
                  className="text-gray-600 hover:text-emerald-600 transition-colors"
                >
                  Recipes
                </Link>
                <Link
                  href="/groceries"
                  className="text-gray-600 hover:text-emerald-600 transition-colors"
                >
                  Grocery List
                </Link>
                <Link
                  href="/settings"
                  className="text-gray-600 hover:text-emerald-600 transition-colors"
                >
                  Settings
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {status === "loading" ? (
              <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
            ) : session ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {session.user?.name}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
