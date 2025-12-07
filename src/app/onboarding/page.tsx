"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("Wurgprat");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      setError("Please enter a household name");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/household", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: householdName }),
      });

      if (response.ok) {
        // Update the session to reflect the new household
        await update();
        router.push("/");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create household");
      }
    } catch {
      setError("Failed to create household. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to continue.</p>
      </div>
    );
  }

  if (session.hasHousehold) {
    router.push("/");
    return null;
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Meal Planner!
        </h1>
        <p className="text-gray-600">
          Let&apos;s set up your household to get started.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Create Your Household
        </h2>
        <p className="text-gray-600 mb-6">
          A household is where you and your family members can share recipes,
          meal plans, and grocery lists.
        </p>

        <div className="mb-6">
          <label
            htmlFor="household-name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Household Name
          </label>
          <input
            type="text"
            id="household-name"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="e.g., The Smiths"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-800">
            {error}
          </div>
        )}

        <button
          onClick={handleCreateHousehold}
          disabled={isCreating}
          className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? "Creating..." : "Create Household"}
        </button>
      </div>
    </div>
  );
}
