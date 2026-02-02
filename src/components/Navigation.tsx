"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useHousehold } from "@/contexts/HouseholdContext";
import type { Kid } from "@/types";

const weeklyPlanningLinks = [
  { href: "/weekly-plans", label: "Weekly Plans" },
  { href: "/recipes", label: "Recipes" },
  { href: "/queue", label: "Queue" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/stores", label: "Stores" },
  { href: "/departments", label: "Departments" },
];

export default function Navigation() {
  const { data: session, status } = useSession();
  const { name: householdName } = useHousehold();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPlanningMenuOpen, setIsPlanningMenuOpen] = useState(false);
  const [isKidsMenuOpen, setIsKidsMenuOpen] = useState(false);
  const [kids, setKids] = useState<Kid[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const planningMenuRef = useRef<HTMLDivElement>(null);
  const kidsMenuRef = useRef<HTMLDivElement>(null);

  // Mobile menu expanded sections
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isPlanningActive = () => {
    return weeklyPlanningLinks.some(link => pathname.startsWith(link.href));
  };

  const isKidsActive = () => {
    return pathname.startsWith("/kids");
  };

  // Fetch kids
  useEffect(() => {
    if (!session) return;

    const fetchKids = async () => {
      try {
        const response = await fetch("/api/kids");
        if (response.ok) {
          const data = await response.json();
          setKids(data.kids || []);
        }
      } catch (error) {
        console.error("Failed to fetch kids:", error);
      }
    };

    fetchKids();
  }, [session?.user?.email]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (planningMenuRef.current && !planningMenuRef.current.contains(event.target as Node)) {
        setIsPlanningMenuOpen(false);
      }
      if (kidsMenuRef.current && !kidsMenuRef.current.contains(event.target as Node)) {
        setIsKidsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsPlanningMenuOpen(false);
    setIsKidsMenuOpen(false);
  }, [pathname]);

  const DropdownChevron = ({ isOpen }: { isOpen: boolean }) => (
    <svg
      className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-xl font-bold text-emerald-600">
              {householdName || "Home"}
            </Link>
            {session && (
              <div className="hidden lg:flex items-center space-x-1">
                {/* Weekly Planning Dropdown */}
                <div className="relative" ref={planningMenuRef}>
                  <button
                    onClick={() => {
                      setIsPlanningMenuOpen(!isPlanningMenuOpen);
                      setIsKidsMenuOpen(false);
                    }}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isPlanningActive()
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-600 hover:text-emerald-600 hover:bg-gray-50"
                    }`}
                  >
                    <span>Weekly Planning</span>
                    <DropdownChevron isOpen={isPlanningMenuOpen} />
                  </button>

                  {isPlanningMenuOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                      {weeklyPlanningLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsPlanningMenuOpen(false)}
                          className={`block px-4 py-2 text-sm ${
                            isActive(link.href)
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Events - standalone */}
                <Link
                  href="/events"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive("/events")
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-600 hover:text-emerald-600 hover:bg-gray-50"
                  }`}
                >
                  Events
                </Link>

                {/* Kids Dropdown */}
                <div className="relative" ref={kidsMenuRef}>
                  <button
                    onClick={() => {
                      setIsKidsMenuOpen(!isKidsMenuOpen);
                      setIsPlanningMenuOpen(false);
                    }}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isKidsActive()
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-600 hover:text-emerald-600 hover:bg-gray-50"
                    }`}
                  >
                    <span>Kids</span>
                    <DropdownChevron isOpen={isKidsMenuOpen} />
                  </button>

                  {isKidsMenuOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                      {kids.length > 0 ? (
                        <>
                          {kids.map((kid) => (
                            <Link
                              key={kid.id}
                              href={`/kids/${kid.id}`}
                              onClick={() => setIsKidsMenuOpen(false)}
                              className={`block px-4 py-2 text-sm ${
                                pathname === `/kids/${kid.id}`
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              {kid.first_name}
                            </Link>
                          ))}
                          <div className="border-t my-1" />
                        </>
                      ) : null}
                      <Link
                        href="/kids"
                        onClick={() => setIsKidsMenuOpen(false)}
                        className={`block px-4 py-2 text-sm ${
                          pathname === "/kids"
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {kids.length > 0 ? "Manage Kids" : "Add Kids"}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {status === "loading" ? (
              <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
            ) : session ? (
              <div className="flex items-center space-x-2">
                {/* User Menu - hidden on mobile since hamburger menu has these options */}
                <div className="relative hidden lg:block" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-emerald-600 hover:bg-gray-50 transition-colors"
                  >
                    <span>{session.user?.name}</span>
                    <DropdownChevron isOpen={isUserMenuOpen} />
                  </button>

                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                      <Link
                        href="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          signOut();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile menu button - larger touch target */}
                <button
                  className="lg:hidden p-2.5 -mr-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={isMobileMenuOpen}
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {isMobileMenuOpen ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    )}
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 active:scale-95 transition-all duration-150 ease-spring"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Mobile Slide-in Menu */}
      {session && (
        <>
          {/* Backdrop overlay */}
          <div
            className={`lg:hidden fixed inset-0 bg-black/40 backdrop-blur-subtle z-40 transition-opacity duration-300 ease-spring ${
              isMobileMenuOpen
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-in drawer panel */}
          <div
            className={`lg:hidden fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-spring ${
              isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 h-16 border-b">
              <span className="text-lg font-semibold text-gray-900">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 -mr-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors btn-press"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer content */}
            <div className="flex flex-col h-[calc(100%-4rem)] overflow-y-auto">
              {/* Navigation links */}
              <nav className="flex-1 px-3 py-4 space-y-1">
                {/* Weekly Planning Section */}
                <div>
                  <button
                    onClick={() => setMobileExpandedSection(
                      mobileExpandedSection === "planning" ? null : "planning"
                    )}
                    className={`flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-base font-medium transition-colors touch-feedback ${
                      isPlanningActive()
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    }`}
                  >
                    <span>Weekly Planning</span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        mobileExpandedSection === "planning" ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {mobileExpandedSection === "planning" && (
                    <div className="mt-1 ml-4 space-y-1">
                      {weeklyPlanningLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center px-4 py-3 rounded-xl text-base transition-colors ${
                            isActive(link.href)
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Events - standalone */}
                <Link
                  href="/events"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3.5 rounded-xl text-base font-medium transition-colors touch-feedback ${
                    isActive("/events")
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  }`}
                >
                  Events
                  <svg
                    className="w-5 h-5 ml-auto text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* Kids Section */}
                <div>
                  <button
                    onClick={() => setMobileExpandedSection(
                      mobileExpandedSection === "kids" ? null : "kids"
                    )}
                    className={`flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-base font-medium transition-colors touch-feedback ${
                      isKidsActive()
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    }`}
                  >
                    <span>Kids</span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        mobileExpandedSection === "kids" ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {mobileExpandedSection === "kids" && (
                    <div className="mt-1 ml-4 space-y-1">
                      {kids.map((kid) => (
                        <Link
                          key={kid.id}
                          href={`/kids/${kid.id}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center px-4 py-3 rounded-xl text-base transition-colors ${
                            pathname === `/kids/${kid.id}`
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                          }`}
                        >
                          {kid.first_name}
                        </Link>
                      ))}
                      <Link
                        href="/kids"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center px-4 py-3 rounded-xl text-base transition-colors ${
                          pathname === "/kids"
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                        }`}
                      >
                        {kids.length > 0 ? "Manage Kids" : "Add Kids"}
                      </Link>
                    </div>
                  )}
                </div>
              </nav>

              {/* Footer actions */}
              <div className="px-3 py-4 border-t bg-gray-50/50">
                <Link
                  href="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3.5 rounded-xl text-base font-medium transition-all touch-feedback ${
                    isActive("/settings")
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                  }`}
                >
                  <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    signOut();
                  }}
                  className="flex items-center w-full px-4 py-3.5 mt-1 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-all touch-feedback"
                >
                  <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
