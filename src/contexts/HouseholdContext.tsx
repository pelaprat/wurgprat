"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { signIn, useSession } from "next-auth/react";
import { getBrowserTimezone } from "@/constants/timezones";

interface HouseholdContextType {
  name: string | null;
  timezone: string;
  isLoading: boolean;
  error: string | null;
  refreshHousehold: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [name, setName] = useState<string | null>(null);
  // Use browser's timezone as the default instead of hardcoded US timezone
  const [timezone, setTimezone] = useState<string>(() => getBrowserTimezone());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHousehold = useCallback(async () => {
    if (!session?.user?.email) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setName(data.name || null);
        // Fall back to browser timezone if none is configured
        setTimezone(data.timezone || getBrowserTimezone());
      } else {
        const data = await response.json();
        setError(data.error || "Failed to fetch household");
      }
    } catch (err) {
      console.error("Failed to fetch household:", err);
      setError("Failed to fetch household");
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      // If the Google refresh token is invalid, force re-authentication
      if (session.error === "RefreshAccessTokenError") {
        signIn("google");
        return;
      }
      fetchHousehold();
    }
  }, [status, session?.user?.email, session?.error, fetchHousehold]);

  return (
    <HouseholdContext.Provider
      value={{
        name,
        timezone,
        isLoading,
        error,
        refreshHousehold: fetchHousehold,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return context;
}
