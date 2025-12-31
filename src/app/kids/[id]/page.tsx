"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
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
  type: "allowance" | "prat_points";
  currentValue: number;
}

export default function KidDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const router = useRouter();
  const [kid, setKid] = useState<Kid | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    birth_date: "",
    allowance_balance: "",
    prat_points: "",
  });
  const [quickAdjust, setQuickAdjust] = useState<QuickAdjustModal | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    if (session && id) {
      fetchKid();
    }
  }, [session, id]);

  const fetchKid = async () => {
    try {
      const response = await fetch(`/api/kids/${id}`);
      if (response.ok) {
        const data = await response.json();
        setKid(data.kid);
        setFormData({
          first_name: data.kid.first_name || "",
          last_name: data.kid.last_name || "",
          email: data.kid.email || "",
          birth_date: data.kid.birth_date || "",
          allowance_balance: data.kid.allowance_balance?.toString() || "0",
          prat_points: data.kid.prat_points?.toString() || "0",
        });
      } else {
        setError("Kid not found");
      }
    } catch (error) {
      console.error("Failed to fetch kid:", error);
      setError("Failed to load kid");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.first_name.trim()) {
      setError("First name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/kids/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim() || null,
          email: formData.email.trim() || null,
          birth_date: formData.birth_date || null,
          allowance_balance: formData.allowance_balance
            ? parseFloat(formData.allowance_balance)
            : 0,
          prat_points: formData.prat_points
            ? parseInt(formData.prat_points, 10)
            : 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setKid(data.kid);
        setIsEditing(false);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (kid) {
      setFormData({
        first_name: kid.first_name || "",
        last_name: kid.last_name || "",
        email: kid.email || "",
        birth_date: kid.birth_date || "",
        allowance_balance: kid.allowance_balance?.toString() || "0",
        prat_points: kid.prat_points?.toString() || "0",
      });
    }
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (!kid) return;
    if (
      !confirm(
        `Delete "${kid.first_name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/kids/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/kids");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Failed to delete");
    }
  };

  const openQuickAdjust = (type: "allowance" | "prat_points") => {
    if (!kid) return;
    setQuickAdjust({
      type,
      currentValue: type === "allowance" ? kid.allowance_balance : kid.prat_points,
    });
    setCustomAmount("");
  };

  const handleQuickAdjust = async (amount: number) => {
    if (!quickAdjust || !kid) return;

    setIsAdjusting(true);
    const newValue = quickAdjust.currentValue + amount;

    try {
      const response = await fetch(`/api/kids/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [quickAdjust.type === "allowance" ? "allowance_balance" : "prat_points"]:
            Math.max(0, newValue),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setKid(data.kid);
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
        <p className="text-gray-600">Please sign in to view kid details.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeaderSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!kid) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/kids"
            className="text-emerald-600 hover:text-emerald-700 text-sm"
          >
            &larr; Back to Kids
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-500">{error || "Kid not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Quick Adjust Modal */}
      {quickAdjust && kid && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:w-96 sm:rounded-xl rounded-t-xl shadow-xl p-6 animate-slideUp sm:animate-scaleIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {kid.first_name}&apos;s {quickAdjust.type === "allowance" ? "Allowance" : "Prat Points"}
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

      <div className="mb-6">
        <Link
          href="/kids"
          className="text-emerald-600 hover:text-emerald-700 text-sm"
        >
          &larr; Back to Kids
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {kid.first_name} {kid.last_name}
          </h1>
          {kid.birth_date && (
            <p className="text-gray-500 mt-1">
              {calculateAge(kid.birth_date)} years old
            </p>
          )}
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Last Name
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="birth_date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Birth Date
              </label>
              <input
                type="date"
                id="birth_date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="allowance_balance"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Allowance Balance ($)
                </label>
                <input
                  type="number"
                  id="allowance_balance"
                  name="allowance_balance"
                  value={formData.allowance_balance}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="prat_points"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Prat Points
                </label>
                <input
                  type="number"
                  id="prat_points"
                  name="prat_points"
                  value={formData.prat_points}
                  onChange={handleChange}
                  step="1"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                Delete
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Email
                </h3>
                <p className="text-gray-900">{kid.email || "—"}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Birth Date
                </h3>
                <p className="text-gray-900">
                  {kid.birth_date
                    ? new Date(kid.birth_date + "T00:00:00").toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Balances
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={() => openQuickAdjust("allowance")}
                  className="bg-gray-50 rounded-lg p-4 text-left hover:bg-gray-100 active:scale-[0.98] transition-all"
                >
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Allowance
                  </h3>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(kid.allowance_balance)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Tap to adjust</p>
                </button>

                <button
                  onClick={() => openQuickAdjust("prat_points")}
                  className="bg-emerald-50 rounded-lg p-4 text-left hover:bg-emerald-100 active:scale-[0.98] transition-all"
                >
                  <h3 className="text-sm font-medium text-emerald-700 mb-1">
                    Prat Points
                  </h3>
                  <p className="text-2xl font-semibold text-emerald-600">
                    {kid.prat_points}
                  </p>
                  <p className="text-xs text-emerald-500 mt-1">Tap to adjust</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
