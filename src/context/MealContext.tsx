import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuItem, FAKE_MENU } from '../services/menuService';
import { Venue } from '../services/venueService';

const STORAGE_KEY = '@dininglens_meal_log';

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
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  periodLabel: string;
  setPeriodLabel: (label: string) => void;
  venue: Venue | null;
  setVenue: (venue: Venue | null) => void;
};

const MealContext = createContext<MealContextType>({
  mealLog: [],
  addMeal: () => {},
  menuItems: FAKE_MENU,
  setMenuItems: () => {},
  periodLabel: 'Dinner',
  setPeriodLabel: () => {},
  venue: null,
  setVenue: () => {},
});

export function MealProvider({ children }: { children: ReactNode }) {
  const [mealLog, setMealLog] = useState<LoggedMeal[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(FAKE_MENU);
  const [periodLabel, setPeriodLabel] = useState('Dinner');
  const [venue, setVenue] = useState<Venue | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          setMealLog(JSON.parse(raw));
        } catch {
          // corrupted storage — start fresh
        }
      }
    });
  }, []);

  function addMeal(meal: LoggedMeal) {
    setMealLog(prev => {
      const next = [meal, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <MealContext.Provider
      value={{ mealLog, addMeal, menuItems, setMenuItems, periodLabel, setPeriodLabel, venue, setVenue }}
    >
      {children}
    </MealContext.Provider>
  );
}

export function useMealContext() {
  return useContext(MealContext);
}
