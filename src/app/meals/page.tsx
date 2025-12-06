"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { format, startOfWeek, addDays } from "date-fns";

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

type MealType = (typeof MEAL_TYPES)[number];

interface DayPlan {
  [key: string]: string;
}

interface WeekPlan {
  [date: string]: DayPlan;
}

export default function MealsPage() {
  const { data: session } = useSession();
  const [weekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [weekPlan, setWeekPlan] = useState<WeekPlan>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getMeal = (date: Date, mealType: MealType): string => {
    const dateKey = format(date, "yyyy-MM-dd");
    return weekPlan[dateKey]?.[mealType] || "";
  };

  const setMeal = (date: Date, mealType: MealType, value: string) => {
    const dateKey = format(date, "yyyy-MM-dd");
    setWeekPlan((prev) => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [mealType]: value,
      },
    }));
  };

  const cellKey = (date: Date, mealType: MealType) =>
    `${format(date, "yyyy-MM-dd")}-${mealType}`;

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view your meal plan.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Week of {format(weekStart, "MMMM d, yyyy")}
        </h1>
        <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
          Sync to Calendar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-8 border-b">
          <div className="p-4 bg-gray-50 font-medium text-gray-500"></div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="p-4 bg-gray-50 text-center border-l"
            >
              <div className="font-medium text-gray-900">
                {format(day, "EEE")}
              </div>
              <div className="text-sm text-gray-500">{format(day, "MMM d")}</div>
            </div>
          ))}
        </div>

        {MEAL_TYPES.map((mealType) => (
          <div key={mealType} className="grid grid-cols-8 border-b last:border-b-0">
            <div className="p-4 bg-gray-50 font-medium text-gray-700 capitalize flex items-center">
              {mealType === "breakfast" && "🌅 "}
              {mealType === "lunch" && "☀️ "}
              {mealType === "dinner" && "🌙 "}
              {mealType}
            </div>
            {days.map((day) => {
              const key = cellKey(day, mealType);
              const isEditing = editingCell === key;
              const meal = getMeal(day, mealType);

              return (
                <div
                  key={key}
                  className="p-2 border-l min-h-[80px] hover:bg-gray-50 cursor-pointer"
                  onClick={() => setEditingCell(key)}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      className="w-full h-full p-2 text-sm border rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      value={meal}
                      onChange={(e) => setMeal(day, mealType, e.target.value)}
                      onBlur={() => setEditingCell(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setEditingCell(null);
                      }}
                      autoFocus
                      placeholder="Add meal..."
                    />
                  ) : (
                    <div className="text-sm text-gray-700 p-2">
                      {meal || (
                        <span className="text-gray-400 italic">+ Add meal</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end space-x-4">
        <button className="text-emerald-600 hover:text-emerald-700 font-medium">
          Generate Grocery List →
        </button>
      </div>
    </div>
  );
}
