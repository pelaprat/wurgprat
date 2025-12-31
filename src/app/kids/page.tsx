"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PageHeaderSkeleton, CardSkeleton } from "@/components/Skeleton";
import type { Kid } from "@/types";

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

interface QuickAdjustModal {
  kidId: string;
  kidName: string;
  type: "allowance" | "prat_points";
  currentValue: number;
}

export default function KidsPage() {
  const { data: session } = useSession();
  const [kids, setKids] = useState<Kid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickAdjust, setQuickAdjust] = useState<QuickAdjustModal | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    if (session) {
      fetchKids();
    }
  }, [session]);

  const fetchKids = async () => {
    try {
      const response = await fetch("/api/kids");
      if (response.ok) {
        const data = await response.json();
        setKids(data.kids || []);
      }
    } catch (error) {
      console.error("Failed to fetch kids:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/kids/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setKids((prev) => prev.filter((k) => k.id !== id));
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete");
    }
  };

  const openQuickAdjust = (
    kid: Kid,
    type: "allowance" | "prat_points"
  ) => {
    setQuickAdjust({
      kidId: kid.id,
      kidName: kid.first_name,
      type,
      currentValue: type === "allowance" ? kid.allowance_balance : kid.prat_points,
    });
    setCustomAmount("");
  };

  const handleQuickAdjust = async (amount: number) => {
    if (!quickAdjust) return;

    setIsAdjusting(true);
    const newValue = quickAdjust.currentValue + amount;

    try {
      const response = await fetch(`/api/kids/${quickAdjust.kidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [quickAdjust.type === "allowance" ? "allowance_balance" : "prat_points"]:
            Math.max(0, newValue),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setKids((prev) =>
          prev.map((k) => (k.id === quickAdjust.kidId ? data.kid : k))
        );
        setQuickAdjust({
          ...quickAdjust,
          currentValue: Math.max(0, newValue),
        });
      }
    } catch (error) {
      console.error("Failed to adjust:", error);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleCustomAdjust = () => {
    const amount = parseFloat(customAmount);
    if (!isNaN(amount)) {
      handleQuickAdjust(amount);
      setCustomAmount("");
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view kids.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeaderSkeleton />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Quick Adjust Modal */}
      {quickAdjust && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:w-96 sm:rounded-xl rounded-t-xl shadow-xl p-6 animate-slideUp sm:animate-scaleIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {quickAdjust.kidName}&apos;s {quickAdjust.type === "allowance" ? "Allowance" : "Prat Points"}
              </h3>
              <button
                onClick={() => setQuickAdjust(null)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current Value */}
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500 mb-1">Current Balance</p>
              <p className={`text-3xl font-bold ${quickAdjust.type === "allowance" ? "text-gray-900" : "text-emerald-600"}`}>
                {quickAdjust.type === "allowance"
                  ? formatCurrency(quickAdjust.currentValue)
                  : quickAdjust.currentValue}
              </p>
            </div>

            {/* Quick Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickAdjust.type === "allowance" ? (
                <>
                  <button
                    onClick={() => handleQuickAdjust(-5)}
                    disabled={isAdjusting}
                    className="py-3 px-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    -$5
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(-1)}
                    disabled={isAdjusting}
                    className="py-3 px-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    -$1
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(1)}
                    disabled={isAdjusting}
                    className="py-3 px-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    +$1
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(5)}
                    disabled={isAdjusting}
                    className="py-3 px-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    +$5
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleQuickAdjust(-5)}
                    disabled={isAdjusting}
                    className="py-3 px-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(-1)}
                    disabled={isAdjusting}
                    className="py-3 px-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(1)}
                    disabled={isAdjusting}
                    className="py-3 px-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(5)}
                    disabled={isAdjusting}
                    className="py-3 px-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 active:scale-95 transition-all disabled:opacity-50"
                  >
                    +5
                  </button>
                </>
              )}
            </div>

            {/* Custom Amount */}
            <div className="flex gap-2">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder={quickAdjust.type === "allowance" ? "Custom amount..." : "Custom points..."}
                step={quickAdjust.type === "allowance" ? "0.01" : "1"}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleCustomAdjust()}
              />
              <button
                onClick={handleCustomAdjust}
                disabled={isAdjusting || !customAmount}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50"
              >
                Add
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-3">
              Use negative numbers to subtract
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kids</h1>
        <Link
          href="/kids/new"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          Add Kid
        </Link>
      </div>

      {/* Kids List */}
      {kids.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-500 mb-4">No kids yet.</p>
          <Link
            href="/kids/new"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Add your first kid
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {kids.map((kid) => (
              <Link
                key={kid.id}
                href={`/kids/${kid.id}`}
                className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">
                      {kid.first_name} {kid.last_name}
                    </h3>
                    {kid.birth_date && (
                      <p className="text-sm text-gray-500 mt-1">
                        {calculateAge(kid.birth_date)} years old
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openQuickAdjust(kid, "allowance");
                        }}
                        className="text-sm px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
                      >
                        <span className="text-gray-500">Allowance:</span>{" "}
                        <span className="font-medium text-gray-900">
                          {formatCurrency(kid.allowance_balance)}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openQuickAdjust(kid, "prat_points");
                        }}
                        className="text-sm px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all"
                      >
                        <span className="text-gray-500">Points:</span>{" "}
                        <span className="font-medium text-emerald-600">
                          {kid.prat_points}
                        </span>
                      </button>
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
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
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-24">
                    Age
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-32">
                    Allowance
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-32">
                    Prat Points
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {kids.map((kid) => (
                  <tr key={kid.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/kids/${kid.id}`}
                        className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                      >
                        {kid.first_name} {kid.last_name}
                      </Link>
                      {kid.email && (
                        <p className="text-sm text-gray-500">{kid.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {kid.birth_date ? `${calculateAge(kid.birth_date)} yrs` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openQuickAdjust(kid, "allowance")}
                        className="text-sm font-medium text-gray-900 px-2 py-1 rounded hover:bg-gray-100 active:scale-95 transition-all"
                      >
                        {formatCurrency(kid.allowance_balance)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openQuickAdjust(kid, "prat_points")}
                        className="text-sm font-medium text-emerald-600 px-2 py-1 rounded hover:bg-emerald-50 active:scale-95 transition-all"
                      >
                        {kid.prat_points}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(kid.id, kid.first_name);
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Delete"
                      >
                        Delete
                      </button>
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
