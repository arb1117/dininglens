import React, { createContext, useContext, useState, ReactNode } from 'react';

export type MacroItem = {
  name: string;
  portion: 'Small' | 'Normal' | 'Large' | 'Double';
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type LoggedMeal = {
  id: string;
  timestamp: string;
  items: MacroItem[];
  totals: { cal: number; protein: number; carbs: number; fat: number };
};

type MealContextType = {
  mealLog: LoggedMeal[];
  addMeal: (meal: LoggedMeal) => void;
};

const MealContext = createContext<MealContextType>({ mealLog: [], addMeal: () => {} });

export function MealProvider({ children }: { children: ReactNode }) {
  const [mealLog, setMealLog] = useState<LoggedMeal[]>([]);

  function addMeal(meal: LoggedMeal) {
    setMealLog(prev => [meal, ...prev]);
  }

  return <MealContext.Provider value={{ mealLog, addMeal }}>{children}</MealContext.Provider>;
}

export function useMealContext() {
  return useContext(MealContext);
}
