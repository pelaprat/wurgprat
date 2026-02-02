"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { Event } from "./EventsContext";
import { getNextSaturday } from "@/utils/dates";

const WIZARD_STORAGE_KEY = "mealPlanWizard";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Types for the wizard
export interface ProposedMeal {
  mealId: string; // Unique identifier for this meal slot
  day: number; // 1-7 (Sat-Fri)
  date: string; // ISO date string
  recipeId?: string;
  recipeName: string;
  recipeTimeRating?: number; // 1-5 scale
  customMealName?: string;
  sortOrder?: number; // Order within the day
  assignedUserId?: string; // User responsible for cooking
}

export interface EventAssignment {
  eventId: string;
  assignedUserIds: string[]; // Multiple users can be assigned to an event
}

export interface RecipeBreakdown {
  recipeId: string;
  recipeName: string;
  quantity: string;
  unit: string;
}

export interface GroceryItemDraft {
  id: string; // temporary id for UI
  ingredientId?: string; // optional for manual adds
  ingredientName: string;
  department: string;
  storeId?: string; // editable store assignment
  storeName?: string; // for display
  totalQuantity: string;
  unit: string;
  recipeBreakdown: RecipeBreakdown[];
  isManualAdd: boolean;
  isStaple: boolean;
  checked: boolean;
}

export interface StapleItemDraft {
  id: string; // temporary id for UI
  ingredientId: string;
  ingredientName: string;
  department: string;
  storeId?: string;
  storeName?: string;
  quantity: string;
  unit: string;
}

export interface MealPlanWizardState {
  // Phase 1 inputs
  weekOf: string; // Saturday start date (ISO string)
  userDescription: string;
  selectedRecipeIds: string[];

  // Phase 2 data (AI-generated)
  proposedMeals: ProposedMeal[];
  weekEvents: Event[]; // Events for the selected week

  // Phase 2.5 data (event assignments)
  eventAssignments: EventAssignment[];

  // Phase 2.75 data (staples)
  stapleItems: StapleItemDraft[];

  // Phase 3 data
  groceryItems: GroceryItemDraft[];

  // Loading states
  isGeneratingGroceries: boolean;
  isFinalizing: boolean;
}

interface MealPlanWizardContextType extends MealPlanWizardState {
  // Phase 1 actions
  setWeekOf: (date: string) => void;
  setUserDescription: (description: string) => void;
  toggleRecipeSelection: (recipeId: string) => void;
  setSelectedRecipeIds: (ids: string[]) => void;

  // Phase 2 actions
  setProposedMeals: (meals: ProposedMeal[]) => void;
  setWeekEvents: (events: Event[]) => void;
  updateMeal: (day: number, meal: ProposedMeal) => void;
  updateMealById: (mealId: string, updates: Partial<ProposedMeal>) => void;
  removeMeal: (mealId: string) => void;
  addMealToDay: (day: number, date: string, meal: Omit<ProposedMeal, "mealId" | "day" | "date">) => void;
  swapMeals: (day1: number, day2: number) => void;
  swapMealsById: (mealId1: string, mealId2: string) => void;
  getMealsForDay: (day: number) => ProposedMeal[];

  // Phase 2.5 actions (event assignments)
  setEventAssignments: (assignments: EventAssignment[]) => void;
  updateEventAssignment: (eventId: string, userIds: string[]) => void;
  toggleEventUserAssignment: (eventId: string, userId: string) => void;

  // Phase 2.75 actions (staples)
  setStapleItems: (items: StapleItemDraft[]) => void;
  addStapleItem: (item: Omit<StapleItemDraft, "id">) => void;
  updateStapleItem: (id: string, updates: Partial<StapleItemDraft>) => void;
  removeStapleItem: (id: string) => void;

  // Phase 3 actions
  setGroceryItems: (items: GroceryItemDraft[]) => void;
  updateGroceryItem: (id: string, updates: Partial<GroceryItemDraft>) => void;
  removeGroceryItem: (id: string) => void;
  addGroceryItem: (item: Omit<GroceryItemDraft, "id">) => void;
  toggleGroceryItemChecked: (id: string) => void;

  // Loading state setters
  setIsGeneratingGroceries: (value: boolean) => void;
  setIsFinalizing: (value: boolean) => void;

  // Navigation/Reset
  resetWizard: () => void;

  // Restore session
  hasRestorable: boolean;
  showRestoreModal: boolean;
  setShowRestoreModal: (show: boolean) => void;
  restoreSession: () => void;
  discardSavedSession: () => void;
}

const MealPlanWizardContext = createContext<
  MealPlanWizardContextType | undefined
>(undefined);

const initialState: MealPlanWizardState = {
  weekOf: getNextSaturday(),
  userDescription: "",
  selectedRecipeIds: [],
  proposedMeals: [],
  weekEvents: [],
  eventAssignments: [],
  stapleItems: [],
  groceryItems: [],
  isGeneratingGroceries: false,
  isFinalizing: false,
};

export function MealPlanWizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MealPlanWizardState>(initialState);
  const [hasRestorable, setHasRestorable] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Check for restorable session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const isValid = Date.now() - parsed.timestamp < STORAGE_TTL_MS;
        const hasProgress = parsed.proposedMeals?.length > 0 || parsed.selectedRecipeIds?.length > 0;
        if (isValid && hasProgress) {
          setHasRestorable(true);
          setShowRestoreModal(true);
        } else {
          localStorage.removeItem(WIZARD_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(WIZARD_STORAGE_KEY);
    }
  }, []);

  // Auto-save state changes (debounced)
  useEffect(() => {
    // Only save if there's meaningful progress
    const hasProgress = state.proposedMeals.length > 0 || state.selectedRecipeIds.length > 0;
    if (!hasProgress) return;

    const saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({
          weekOf: state.weekOf,
          userDescription: state.userDescription,
          selectedRecipeIds: state.selectedRecipeIds,
          proposedMeals: state.proposedMeals,
          stapleItems: state.stapleItems,
          groceryItems: state.groceryItems,
          eventAssignments: state.eventAssignments,
          timestamp: Date.now()
        }));
      } catch {
        // Storage full or unavailable - fail silently
      }
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [
    state.weekOf,
    state.userDescription,
    state.selectedRecipeIds,
    state.proposedMeals,
    state.stapleItems,
    state.groceryItems,
    state.eventAssignments,
  ]);

  // Restore session from localStorage
  const restoreSession = useCallback(() => {
    try {
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState(prev => ({
          ...prev,
          weekOf: parsed.weekOf || prev.weekOf,
          userDescription: parsed.userDescription || "",
          selectedRecipeIds: parsed.selectedRecipeIds || [],
          proposedMeals: parsed.proposedMeals || [],
          stapleItems: parsed.stapleItems || [],
          groceryItems: parsed.groceryItems || [],
          eventAssignments: parsed.eventAssignments || [],
        }));
      }
    } catch {
      // Parse error - fail silently
    }
    setShowRestoreModal(false);
    setHasRestorable(false);
  }, []);

  // Discard saved session
  const discardSavedSession = useCallback(() => {
    localStorage.removeItem(WIZARD_STORAGE_KEY);
    setShowRestoreModal(false);
    setHasRestorable(false);
  }, []);

  // Phase 1 actions
  const setWeekOf = useCallback((date: string) => {
    setState((prev) => ({ ...prev, weekOf: date }));
  }, []);

  const setUserDescription = useCallback((description: string) => {
    setState((prev) => ({ ...prev, userDescription: description }));
  }, []);

  const toggleRecipeSelection = useCallback((recipeId: string) => {
    setState((prev) => ({
      ...prev,
      selectedRecipeIds: prev.selectedRecipeIds.includes(recipeId)
        ? prev.selectedRecipeIds.filter((id) => id !== recipeId)
        : [...prev.selectedRecipeIds, recipeId],
    }));
  }, []);

  const setSelectedRecipeIds = useCallback((ids: string[]) => {
    setState((prev) => ({ ...prev, selectedRecipeIds: ids }));
  }, []);

  // Phase 2 actions
  const setProposedMeals = useCallback((meals: ProposedMeal[]) => {
    setState((prev) => ({ ...prev, proposedMeals: meals }));
  }, []);

  const setWeekEvents = useCallback((events: Event[]) => {
    setState((prev) => ({ ...prev, weekEvents: events }));
  }, []);

  const updateMeal = useCallback((day: number, meal: ProposedMeal) => {
    setState((prev) => ({
      ...prev,
      proposedMeals: prev.proposedMeals.map((m) => (m.mealId === meal.mealId ? meal : m)),
    }));
  }, []);

  const updateMealById = useCallback((mealId: string, updates: Partial<ProposedMeal>) => {
    setState((prev) => ({
      ...prev,
      proposedMeals: prev.proposedMeals.map((m) =>
        m.mealId === mealId ? { ...m, ...updates } : m
      ),
    }));
  }, []);

  const removeMeal = useCallback((mealId: string) => {
    setState((prev) => ({
      ...prev,
      proposedMeals: prev.proposedMeals.filter((m) => m.mealId !== mealId),
    }));
  }, []);

  const addMealToDay = useCallback(
    (day: number, date: string, meal: Omit<ProposedMeal, "mealId" | "day" | "date">) => {
      setState((prev) => {
        const mealsForDay = prev.proposedMeals.filter((m) => m.day === day);
        const maxSortOrder = mealsForDay.length > 0
          ? Math.max(...mealsForDay.map((m) => m.sortOrder || 0))
          : -1;

        const newMeal: ProposedMeal = {
          ...meal,
          mealId: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          day,
          date,
          sortOrder: maxSortOrder + 1,
        };

        return {
          ...prev,
          proposedMeals: [...prev.proposedMeals, newMeal],
        };
      });
    },
    []
  );

  const getMealsForDay = useCallback(
    (day: number) => {
      return state.proposedMeals
        .filter((m) => m.day === day)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    },
    [state.proposedMeals]
  );

  const swapMeals = useCallback((day1: number, day2: number) => {
    setState((prev) => {
      const meals = [...prev.proposedMeals];
      const meal1Index = meals.findIndex((m) => m.day === day1);
      const meal2Index = meals.findIndex((m) => m.day === day2);

      if (meal1Index === -1 || meal2Index === -1) return prev;

      const meal1 = meals[meal1Index];
      const meal2 = meals[meal2Index];

      // Swap the meals but keep the day and date assignments
      meals[meal1Index] = {
        ...meal2,
        day: meal1.day,
        date: meal1.date,
      };
      meals[meal2Index] = {
        ...meal1,
        day: meal2.day,
        date: meal2.date,
      };

      return { ...prev, proposedMeals: meals };
    });
  }, []);

  const swapMealsById = useCallback((mealId1: string, mealId2: string) => {
    setState((prev) => {
      const meals = [...prev.proposedMeals];
      const meal1Index = meals.findIndex((m) => m.mealId === mealId1);
      const meal2Index = meals.findIndex((m) => m.mealId === mealId2);

      if (meal1Index === -1 || meal2Index === -1) return prev;

      const meal1 = meals[meal1Index];
      const meal2 = meals[meal2Index];

      // Swap the meals but keep the day, date, and sortOrder assignments
      meals[meal1Index] = {
        ...meal2,
        mealId: meal1.mealId,
        day: meal1.day,
        date: meal1.date,
        sortOrder: meal1.sortOrder,
      };
      meals[meal2Index] = {
        ...meal1,
        mealId: meal2.mealId,
        day: meal2.day,
        date: meal2.date,
        sortOrder: meal2.sortOrder,
      };

      return { ...prev, proposedMeals: meals };
    });
  }, []);

  // Phase 2.5 actions (event assignments)
  const setEventAssignments = useCallback((assignments: EventAssignment[]) => {
    setState((prev) => ({ ...prev, eventAssignments: assignments }));
  }, []);

  const updateEventAssignment = useCallback((eventId: string, userIds: string[]) => {
    setState((prev) => {
      const existingIndex = prev.eventAssignments.findIndex((a) => a.eventId === eventId);
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev.eventAssignments];
        updated[existingIndex] = { eventId, assignedUserIds: userIds };
        return { ...prev, eventAssignments: updated };
      } else {
        // Add new
        return {
          ...prev,
          eventAssignments: [...prev.eventAssignments, { eventId, assignedUserIds: userIds }],
        };
      }
    });
  }, []);

  const toggleEventUserAssignment = useCallback((eventId: string, userId: string) => {
    setState((prev) => {
      const existing = prev.eventAssignments.find((a) => a.eventId === eventId);
      if (existing) {
        const hasUser = existing.assignedUserIds.includes(userId);
        const newUserIds = hasUser
          ? existing.assignedUserIds.filter((id) => id !== userId)
          : [...existing.assignedUserIds, userId];
        return {
          ...prev,
          eventAssignments: prev.eventAssignments.map((a) =>
            a.eventId === eventId ? { ...a, assignedUserIds: newUserIds } : a
          ),
        };
      } else {
        return {
          ...prev,
          eventAssignments: [...prev.eventAssignments, { eventId, assignedUserIds: [userId] }],
        };
      }
    });
  }, []);

  // Phase 2.75 actions (staples)
  const setStapleItems = useCallback((items: StapleItemDraft[]) => {
    setState((prev) => ({ ...prev, stapleItems: items }));
  }, []);

  const addStapleItem = useCallback(
    (item: Omit<StapleItemDraft, "id">) => {
      setState((prev) => ({
        ...prev,
        stapleItems: [
          ...prev.stapleItems,
          { ...item, id: `staple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
        ],
      }));
    },
    []
  );

  const updateStapleItem = useCallback(
    (id: string, updates: Partial<StapleItemDraft>) => {
      setState((prev) => ({
        ...prev,
        stapleItems: prev.stapleItems.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }));
    },
    []
  );

  const removeStapleItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      stapleItems: prev.stapleItems.filter((item) => item.id !== id),
    }));
  }, []);

  // Phase 3 actions
  const setGroceryItems = useCallback((items: GroceryItemDraft[]) => {
    setState((prev) => ({ ...prev, groceryItems: items }));
  }, []);

  const updateGroceryItem = useCallback(
    (id: string, updates: Partial<GroceryItemDraft>) => {
      setState((prev) => ({
        ...prev,
        groceryItems: prev.groceryItems.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }));
    },
    []
  );

  const removeGroceryItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      groceryItems: prev.groceryItems.filter((item) => item.id !== id),
    }));
  }, []);

  const addGroceryItem = useCallback(
    (item: Omit<GroceryItemDraft, "id">) => {
      setState((prev) => ({
        ...prev,
        groceryItems: [
          ...prev.groceryItems,
          { ...item, id: `manual-${Date.now()}` },
        ],
      }));
    },
    []
  );

  const toggleGroceryItemChecked = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      groceryItems: prev.groceryItems.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ),
    }));
  }, []);

  // Loading state setters
  const setIsGeneratingGroceries = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isGeneratingGroceries: value }));
  }, []);

  const setIsFinalizing = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isFinalizing: value }));
  }, []);

  // Reset
  const resetWizard = useCallback(() => {
    setState({
      ...initialState,
      weekOf: getNextSaturday(), // Recalculate next Saturday
    });
    // Clear saved session
    localStorage.removeItem(WIZARD_STORAGE_KEY);
    setHasRestorable(false);
  }, []);

  return (
    <MealPlanWizardContext.Provider
      value={{
        ...state,
        setWeekOf,
        setUserDescription,
        toggleRecipeSelection,
        setSelectedRecipeIds,
        setProposedMeals,
        setWeekEvents,
        updateMeal,
        updateMealById,
        removeMeal,
        addMealToDay,
        swapMeals,
        swapMealsById,
        getMealsForDay,
        setEventAssignments,
        updateEventAssignment,
        toggleEventUserAssignment,
        setStapleItems,
        addStapleItem,
        updateStapleItem,
        removeStapleItem,
        setGroceryItems,
        updateGroceryItem,
        removeGroceryItem,
        addGroceryItem,
        toggleGroceryItemChecked,
        setIsGeneratingGroceries,
        setIsFinalizing,
        resetWizard,
        hasRestorable,
        showRestoreModal,
        setShowRestoreModal,
        restoreSession,
        discardSavedSession,
      }}
    >
      {children}
    </MealPlanWizardContext.Provider>
  );
}

export function useMealPlanWizard() {
  const context = useContext(MealPlanWizardContext);
  if (context === undefined) {
    throw new Error(
      "useMealPlanWizard must be used within a MealPlanWizardProvider"
    );
  }
  return context;
}
