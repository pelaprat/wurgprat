"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { EventsProvider } from "@/contexts/EventsContext";
import { HouseholdProvider } from "@/contexts/HouseholdContext";
import { MealPlanWizardProvider } from "@/contexts/MealPlanWizardContext";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <HouseholdProvider>
        <EventsProvider>
          <MealPlanWizardProvider>{children}</MealPlanWizardProvider>
        </EventsProvider>
      </HouseholdProvider>
    </SessionProvider>
  );
}
