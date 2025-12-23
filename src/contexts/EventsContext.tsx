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

export interface WeeklyPlanReference {
  id: string;
  week_of: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  all_day: boolean;
  location?: string;
  html_link?: string;
  created_at?: string;
  weekly_plan_assignments?: {
    weekly_plan: WeeklyPlanReference;
  }[];
}

interface EventsContextType {
  events: Event[];
  isLoading: boolean;
  error: string | null;
  lastSynced: Date | null;
  refreshEvents: () => Promise<void>;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export function EventsProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!session?.user?.email) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/events");
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setLastSynced(new Date());
      } else {
        const data = await response.json();
        setError(data.error || "Failed to fetch events");
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError("Failed to fetch events");
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email]);

  // Fetch events when session becomes available
  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      fetchEvents();
    }
  }, [status, session?.user?.email, fetchEvents]);

  // Refetch when tab becomes visible (user returns to app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && session?.user?.email) {
        fetchEvents();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session?.user?.email, fetchEvents]);

  // Refetch when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      if (session?.user?.email) {
        fetchEvents();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [session?.user?.email, fetchEvents]);

  return (
    <EventsContext.Provider
      value={{
        events,
        isLoading,
        error,
        lastSynced,
        refreshEvents: fetchEvents,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return context;
}
