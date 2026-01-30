"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PageHeaderSkeleton, CardSkeleton } from "@/components/Skeleton";
import type { Kid, AllowanceSplitConfig, AllowanceTransaction } from "@/types";

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

interface SplitBalance {
  key: string;
  name: string;
  percentage: number;
  balance: number;
}

interface AllowanceModalData {
  kidId: string;
  kidName: string;
  totalBalance: number;
  splits: SplitBalance[];
  splitConfig: AllowanceSplitConfig[];
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

  // Allowance modal state
  const [allowanceModal, setAllowanceModal] = useState<AllowanceModalData | null>(null);
  const [allowanceMode, setAllowanceMode] = useState<"view" | "deposit" | "withdraw">("view");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDescription, setDepositDescription] = useState("");
  const [withdrawSplit, setWithdrawSplit] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDescription, setWithdrawDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<AllowanceTransaction[]>([]);
  const [showTransactions, setShowTransactions] = useState(false);

  const fetchKids = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (session) {
      fetchKids();
    }
  }, [session, fetchKids]);

  const openAllowanceModal = async (kid: Kid) => {
    try {
      const response = await fetch(`/api/kids/${kid.id}/allowance`);
      if (response.ok) {
        const data = await response.json();
        setAllowanceModal({
          kidId: kid.id,
          kidName: data.kid_name,
          totalBalance: data.total_balance,
          splits: data.splits,
          splitConfig: data.split_config,
        });
        setAllowanceMode("view");
        setDepositAmount("");
        setDepositDescription("");
        setWithdrawSplit("");
        setWithdrawAmount("");
        setWithdrawDescription("");
        setShowTransactions(false);
        setTransactions([]);
      }
    } catch (error) {
      console.error("Failed to fetch allowance:", error);
    }
  };

  const fetchTransactions = async (kidId: string) => {
    try {
      const response = await fetch(`/api/kids/${kidId}/allowance/transactions?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  };

  const handleDeposit = async () => {
    if (!allowanceModal || !depositAmount) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/kids/${allowanceModal.kidId}/allowance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description: depositDescription || "Allowance",
        }),
      });

      if (response.ok) {
        // Refresh data
        await fetchKids();
        const refreshResponse = await fetch(`/api/kids/${allowanceModal.kidId}/allowance`);
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setAllowanceModal({
            ...allowanceModal,
            totalBalance: data.total_balance,
            splits: data.splits,
          });
        }
        setAllowanceMode("view");
        setDepositAmount("");
        setDepositDescription("");
      }
    } catch (error) {
      console.error("Failed to deposit:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!allowanceModal || !withdrawSplit || !withdrawAmount || !withdrawDescription) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/kids/${allowanceModal.kidId}/allowance/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          split_key: withdrawSplit,
          description: withdrawDescription,
        }),
      });

      if (response.ok) {
        // Refresh data
        await fetchKids();
        const refreshResponse = await fetch(`/api/kids/${allowanceModal.kidId}/allowance`);
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setAllowanceModal({
            ...allowanceModal,
            totalBalance: data.total_balance,
            splits: data.splits,
          });
        }
        setAllowanceMode("view");
        setWithdrawSplit("");
        setWithdrawAmount("");
        setWithdrawDescription("");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to withdraw");
      }
    } catch (error) {
      console.error("Failed to withdraw:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getSplitColor = (key: string) => {
    switch (key) {
      case "charity":
        return { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" };
      case "saving":
        return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" };
      case "spending":
        return { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" };
    }
  };

  const getTotalSplitBalance = (kid: Kid) => {
    if (!kid.allowance_splits || kid.allowance_splits.length === 0) {
      return kid.allowance_balance;
    }
    return kid.allowance_splits.reduce((sum, split) => sum + split.balance, 0);
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

  const openQuickAdjust = (kid: Kid) => {
    setQuickAdjust({
      kidId: kid.id,
      kidName: kid.first_name,
      type: "prat_points",
      currentValue: kid.prat_points,
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
          prat_points: Math.max(0, newValue),
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
      {/* Allowance Modal */}
      {allowanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:w-[28rem] sm:rounded-xl rounded-t-xl shadow-xl p-6 animate-slideUp sm:animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {allowanceModal.kidName}&apos;s Allowance
              </h3>
              <button
                onClick={() => setAllowanceModal(null)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {allowanceMode === "view" && (
              <>
                {/* Total Balance */}
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-500 mb-1">Total Balance</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(allowanceModal.totalBalance)}
                  </p>
                </div>

                {/* Split Balances */}
                <div className="space-y-2 mb-6">
                  {allowanceModal.splits.map((split) => {
                    const colors = getSplitColor(split.key);
                    return (
                      <div
                        key={split.key}
                        className={`flex items-center justify-between p-3 rounded-lg ${colors.bg} ${colors.border} border`}
                      >
                        <div>
                          <span className={`font-medium ${colors.text}`}>{split.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({split.percentage}%)</span>
                        </div>
                        <span className={`font-semibold ${colors.text}`}>
                          {formatCurrency(split.balance)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => setAllowanceMode("deposit")}
                    className="py-3 px-4 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    Add Allowance
                  </button>
                  <button
                    onClick={() => {
                      setAllowanceMode("withdraw");
                      if (allowanceModal.splits.length > 0) {
                        setWithdrawSplit(allowanceModal.splits[0].key);
                      }
                    }}
                    className="py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    Withdraw
                  </button>
                </div>

                {/* Transaction History Toggle */}
                <button
                  onClick={() => {
                    if (!showTransactions) {
                      fetchTransactions(allowanceModal.kidId);
                    }
                    setShowTransactions(!showTransactions);
                  }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  {showTransactions ? "Hide" : "Show"} Transaction History
                </button>

                {/* Transaction History */}
                {showTransactions && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Transactions</h4>
                    {transactions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No transactions yet</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {transactions.map((tx) => {
                          const colors = getSplitColor(tx.split_key);
                          const splitName = allowanceModal.splits.find(s => s.key === tx.split_key)?.name || tx.split_key;
                          return (
                            <div key={tx.id} className="flex items-start justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
                                    {splitName}
                                  </span>
                                  <span className={tx.amount > 0 ? "text-emerald-600" : "text-red-600"}>
                                    {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                                  </span>
                                </div>
                                <p className="text-gray-600 truncate mt-1">{tx.description}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(tx.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {allowanceMode === "deposit" && (
              <>
                <button
                  onClick={() => setAllowanceMode("view")}
                  className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <h4 className="font-medium text-gray-900 mb-4">Add Allowance</h4>

                {/* Split Preview */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-2">Amount will be split:</p>
                  <div className="flex gap-2 flex-wrap">
                    {allowanceModal.splitConfig.map((config) => {
                      const colors = getSplitColor(config.key);
                      return (
                        <span key={config.key} className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text}`}>
                          {config.name}: {config.percentage}%
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={depositDescription}
                      onChange={(e) => setDepositDescription(e.target.value)}
                      placeholder="e.g., Weekly allowance"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={handleDeposit}
                    disabled={isProcessing || !depositAmount || parseFloat(depositAmount) <= 0}
                    className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? "Processing..." : "Add Allowance"}
                  </button>
                </div>
              </>
            )}

            {allowanceMode === "withdraw" && (
              <>
                <button
                  onClick={() => setAllowanceMode("view")}
                  className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <h4 className="font-medium text-gray-900 mb-4">Withdraw</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                    <select
                      value={withdrawSplit}
                      onChange={(e) => setWithdrawSplit(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                    >
                      {allowanceModal.splits.map((split) => (
                        <option key={split.key} value={split.key}>
                          {split.name} ({formatCurrency(split.balance)} available)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
                    <input
                      type="text"
                      value={withdrawDescription}
                      onChange={(e) => setWithdrawDescription(e.target.value)}
                      placeholder="e.g., Bought toy, Donated to charity"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Required: describe what the money was used for</p>
                  </div>
                  <button
                    onClick={handleWithdraw}
                    disabled={isProcessing || !withdrawAmount || !withdrawDescription || parseFloat(withdrawAmount) <= 0}
                    className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? "Processing..." : "Withdraw"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Quick Adjust Modal (for Prat Points only now) */}
      {quickAdjust && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:w-96 sm:rounded-xl rounded-t-xl shadow-xl p-6 animate-slideUp sm:animate-scaleIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {quickAdjust.kidName}&apos;s Prat Points
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
              <p className="text-3xl font-bold text-emerald-600">
                {quickAdjust.currentValue}
              </p>
            </div>

            {/* Quick Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
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
            </div>

            {/* Custom Amount */}
            <div className="flex gap-2">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Custom points..."
                step="1"
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
                    <div className="mt-2 space-y-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openAllowanceModal(kid);
                        }}
                        className="w-full text-left text-sm px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 active:scale-[0.98] transition-all"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Allowance</span>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(getTotalSplitBalance(kid))}
                          </span>
                        </div>
                        {kid.allowance_splits && kid.allowance_splits.length > 0 && (
                          <div className="flex gap-2 mt-1.5">
                            {kid.allowance_splits.map((split) => {
                              const colors = getSplitColor(split.split_key);
                              return (
                                <span key={split.split_key} className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                  {formatCurrency(split.balance)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openQuickAdjust(kid);
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
                        onClick={() => openAllowanceModal(kid)}
                        className="text-sm px-2 py-1 rounded hover:bg-gray-100 active:scale-95 transition-all"
                      >
                        <span className="font-medium text-gray-900">
                          {formatCurrency(getTotalSplitBalance(kid))}
                        </span>
                        {kid.allowance_splits && kid.allowance_splits.length > 0 && (
                          <div className="flex gap-1.5 justify-end mt-1">
                            {kid.allowance_splits.map((split) => {
                              const colors = getSplitColor(split.split_key);
                              return (
                                <span key={split.split_key} className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                  {formatCurrency(split.balance)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openQuickAdjust(kid)}
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
