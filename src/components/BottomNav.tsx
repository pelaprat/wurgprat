"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

interface WeeklyPlan {
  id: string;
  week_of: string;
}

export default function BottomNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [currentPlan, setCurrentPlan] = useState<WeeklyPlan | null>(null);

  // Fetch current week's plan to link directly to grocery list
  useEffect(() => {
    if (!session) return;

    const fetchCurrentPlan = async () => {
      try {
        const response = await fetch("/api/today");
        if (response.ok) {
          const data = await response.json();
          setCurrentPlan(data.weeklyPlan);
        }
      } catch (error) {
        console.error("Failed to fetch current plan:", error);
      }
    };

    fetchCurrentPlan();
  }, [session]);

  if (!session) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const groceryHref = currentPlan
    ? `/weekly-plans/${currentPlan.id}?tab=grocery`
    : "/weekly-plans";

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: "/weekly-plans",
      label: "Plan",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: groceryHref,
      label: "Grocery",
      matchPath: "/weekly-plans",
      isGrocery: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      href: "/recipes",
      label: "Recipes",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          // Special handling for grocery tab detection
          const active = item.isGrocery
            ? pathname.includes("/weekly-plans/") && pathname.includes("grocery")
            : isActive(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors ${
                active
                  ? "text-emerald-600"
                  : "text-gray-500 hover:text-gray-700 active:text-emerald-600"
              }`}
            >
              <div className={`${active ? "scale-110" : ""} transition-transform`}>
                {item.icon}
              </div>
              <span className={`text-xs mt-1 ${active ? "font-medium" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
