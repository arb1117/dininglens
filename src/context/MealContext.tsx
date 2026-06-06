import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuItem, FAKE_MENU } from '../services/menuService';
import { Venue } from '../services/venueService';

const STORAGE_KEY      = '@dininglens_meal_log';
const GOALS_KEY        = '@dininglens_goals';
const LAST_LOGGED_KEY  = '@dininglens_last_logged';

export type UserGoals = {
  preset: 'lose' | 'maintain' | 'build';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const DEFAULT_GOALS: UserGoals = {
  preset: 'maintain',
  calories: 2200,
  protein: 150,
  carbs: 220,
  fat: 70,
};

export type MacroItem = {
  name: string;
  portion: string;
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

function round1(n: number) { return Math.round(n * 10) / 10; }

type MealContextType = {
  mealLog: LoggedMeal[];
  addMeal: (meal: LoggedMeal) => void;
  updateMealItem: (mealId: string, itemIndex: number, updated: MacroItem) => void;
  goals: UserGoals;
  setGoals: (goals: UserGoals) => void;
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
  updateMealItem: () => {},
  goals: DEFAULT_GOALS,
  setGoals: () => {},
  menuItems: FAKE_MENU,
  setMenuItems: () => {},
  periodLabel: 'Dinner',
  setPeriodLabel: () => {},
  venue: null,
  setVenue: () => {},
});

export function MealProvider({ children }: { children: ReactNode }) {
  const [mealLog, setMealLog] = useState<LoggedMeal[]>([]);
  const [goals, setGoalsState] = useState<UserGoals>(DEFAULT_GOALS);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(FAKE_MENU);
  const [periodLabel, setPeriodLabel] = useState('Dinner');
  const [venue, setVenue] = useState<Venue | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try { setMealLog(JSON.parse(raw)); } catch {}
      }
    });
    AsyncStorage.getItem(GOALS_KEY).then(raw => {
      if (raw) {
        try { setGoalsState(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  function setGoals(g: UserGoals) {
    setGoalsState(g);
  }

  function addMeal(meal: LoggedMeal) {
    setMealLog(prev => {
      const next = [meal, ...prev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      AsyncStorage.setItem(LAST_LOGGED_KEY, new Date().toDateString()).catch(() => {});
      return next;
    });
  }

  function updateMealItem(mealId: string, itemIndex: number, updated: MacroItem) {
    setMealLog(prev => {
      const next = prev.map(meal => {
        if (meal.id !== mealId) return meal;
        const newItems = meal.items.map((item, i) => (i === itemIndex ? updated : item));
        const totals = newItems.reduce(
          (acc, item) => ({
            cal: Math.round(acc.cal + item.cal),
            protein: round1(acc.protein + item.protein),
            carbs: round1(acc.carbs + item.carbs),
            fat: round1(acc.fat + item.fat),
          }),
          { cal: 0, protein: 0, carbs: 0, fat: 0 }
        );
        return { ...meal, items: newItems, totals };
      });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <MealContext.Provider
      value={{ mealLog, addMeal, updateMealItem, goals, setGoals, menuItems, setMenuItems, periodLabel, setPeriodLabel, venue, setVenue }}
    >
      {children}
    </MealContext.Provider>
  );
}

export function useMealContext() {
  return useContext(MealContext);
}
