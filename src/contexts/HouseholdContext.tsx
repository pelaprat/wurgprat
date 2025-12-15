"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";

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
  const [timezone, setTimezone] = useState<string>("America/New_York");
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
        setTimezone(data.timezone || "America/New_York");
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
      fetchHousehold();
    }
  }, [status, session?.user?.email, fetchHousehold]);

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
