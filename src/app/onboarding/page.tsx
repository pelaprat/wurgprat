"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface HouseholdResult {
  joined: boolean;
  household_name: string;
}

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("Wurgprat");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<HouseholdResult | null>(null);

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      setError("Please enter a household name");
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/household", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: householdName }),
      });

      const data = await response.json();

      if (response.ok) {
        // Show success message before redirecting
        setSuccess({
          joined: data.joined,
          household_name: data.household_name,
        });

        // Update the session to reflect the new household
        await update();

        // Wait a moment for user to see the message, then redirect
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setError(data.error || "Failed to join household");
      }
    } catch {
      setError("Failed to join household. Please try again.");
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
          Welcome to Wurgprat!
        </h1>
        <p className="text-gray-600">
          Let&apos;s set up your household to get started.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Join or Create a Household
        </h2>
        <p className="text-gray-600 mb-6">
          Enter a household name. If a household with that name already exists,
          you&apos;ll join it. Otherwise, a new household will be created for you.
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
            disabled={!!success}
          />
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-50 text-emerald-800">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                {success.joined
                  ? `You joined the "${success.household_name}" household!`
                  : `Created new household "${success.household_name}" and added you to it!`}
              </span>
            </div>
            <p className="text-sm mt-2 text-emerald-600">Redirecting to home...</p>
          </div>
        )}

        <button
          onClick={handleCreateHousehold}
          disabled={isCreating || !!success}
          className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? "Please wait..." : success ? "Done!" : "Join or Create Household"}
        </button>
      </div>
    </div>
  );
}
