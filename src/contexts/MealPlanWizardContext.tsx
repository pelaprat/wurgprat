"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Event } from "./EventsContext";

// Types for the wizard
export interface ProposedMeal {
  mealId: string; // Unique identifier for this meal slot
  day: number; // 1-7 (Sat-Fri)
  date: string; // ISO date string
  recipeId?: string;
  recipeName: string;
  recipeTimeRating?: number; // 1-5 scale
  customMealName?: string;
  aiReasoning?: string; // Why AI chose this
  isAiSuggested: boolean;
  sortOrder?: number; // Order within the day
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
  totalQuantity: string;
  unit: string;
  recipeBreakdown: RecipeBreakdown[];
  isManualAdd: boolean;
  checked: boolean;
}

export interface MealPlanWizardState {
  // Phase 1 inputs
  weekOf: string; // Saturday start date (ISO string)
  userDescription: string;
  selectedRecipeIds: string[];

  // Phase 2 data (AI-generated)
  proposedMeals: ProposedMeal[];
  weekEvents: Event[]; // Events for the selected week

  // Phase 3 data
  groceryItems: GroceryItemDraft[];

  // AI explanation
  aiExplanation?: string;

  // Loading states
  isGenerating: boolean;
  isReplacingMeal: boolean;
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
  setAiExplanation: (explanation: string) => void;
  getMealsForDay: (day: number) => ProposedMeal[];

  // Phase 3 actions
  setGroceryItems: (items: GroceryItemDraft[]) => void;
  updateGroceryItem: (id: string, updates: Partial<GroceryItemDraft>) => void;
  removeGroceryItem: (id: string) => void;
  addGroceryItem: (item: Omit<GroceryItemDraft, "id">) => void;
  toggleGroceryItemChecked: (id: string) => void;

  // Loading state setters
  setIsGenerating: (value: boolean) => void;
  setIsReplacingMeal: (value: boolean) => void;
  setIsGeneratingGroceries: (value: boolean) => void;
  setIsFinalizing: (value: boolean) => void;

  // Navigation/Reset
  resetWizard: () => void;
}

const MealPlanWizardContext = createContext<
  MealPlanWizardContextType | undefined
>(undefined);

// Get next Saturday date
function getNextSaturday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7; // 0 means today is Saturday, so go to next week
  const nextSaturday = new Date(today);
  nextSaturday.setDate(today.getDate() + daysUntilSaturday);
  return nextSaturday.toISOString().split("T")[0];
}

const initialState: MealPlanWizardState = {
  weekOf: getNextSaturday(),
  userDescription: "",
  selectedRecipeIds: [],
  proposedMeals: [],
  weekEvents: [],
  groceryItems: [],
  aiExplanation: undefined,
  isGenerating: false,
  isReplacingMeal: false,
  isGeneratingGroceries: false,
  isFinalizing: false,
};

export function MealPlanWizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MealPlanWizardState>(initialState);

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
        isAiSuggested: false, // Mark as user-modified
      };
      meals[meal2Index] = {
        ...meal1,
        day: meal2.day,
        date: meal2.date,
        isAiSuggested: false, // Mark as user-modified
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
        isAiSuggested: false,
      };
      meals[meal2Index] = {
        ...meal1,
        mealId: meal2.mealId,
        day: meal2.day,
        date: meal2.date,
        sortOrder: meal2.sortOrder,
        isAiSuggested: false,
      };

      return { ...prev, proposedMeals: meals };
    });
  }, []);

  const setAiExplanation = useCallback((explanation: string) => {
    setState((prev) => ({ ...prev, aiExplanation: explanation }));
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
  const setIsGenerating = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isGenerating: value }));
  }, []);

  const setIsReplacingMeal = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isReplacingMeal: value }));
  }, []);

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
        setAiExplanation,
        getMealsForDay,
        setGroceryItems,
        updateGroceryItem,
        removeGroceryItem,
        addGroceryItem,
        toggleGroceryItemChecked,
        setIsGenerating,
        setIsReplacingMeal,
        setIsGeneratingGroceries,
        setIsFinalizing,
        resetWizard,
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
