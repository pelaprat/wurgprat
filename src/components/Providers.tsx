"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { EventsProvider } from "@/contexts/EventsContext";
import { HouseholdProvider } from "@/contexts/HouseholdContext";
import { MealPlanWizardProvider } from "@/contexts/MealPlanWizardContext";
import { ToastProvider } from "@/components/Toast";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <HouseholdProvider>
        <EventsProvider>
          <MealPlanWizardProvider>
            <ToastProvider>{children}</ToastProvider>
          </MealPlanWizardProvider>
        </EventsProvider>
      </HouseholdProvider>
    </SessionProvider>
  );
}
