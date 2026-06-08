import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuItem, FAKE_MENU } from '../services/menuService';
import { Venue } from '../services/venueService';

const STORAGE_KEY      = '@dininglens_meal_log';
const GOALS_KEY        = '@dininglens_goals';
const LAST_LOGGED_KEY  = '@dininglens_last_logged';

export type UserGoals = {
  preset: 'lose' | 'maintain' | 'build' | 'recomposition';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type UserProfile = {
  useMetric?: boolean;
  heightFt?: number;
  heightIn?: number;
  heightCm?: number;
  weightLbs?: number;
  weightKg?: number;
  sex?: 'male' | 'female' | 'other';
  age?: number;
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  activityDescription?: string;
  dailySteps?: number;
  workoutsPerWeek?: number;
  workoutIntensity?: 'light' | 'moderate' | 'intense';
  jobType?: 'desk' | 'lightly_active' | 'very_active';
  bodyGoal?: 'lose_fat' | 'maintain' | 'gain_muscle' | 'recomposition';
  calculatedCalories?: number;
  calculatedProtein?: number;
  calculatedFat?: number;
  calculatedCarbs?: number;
  calorieOverride?: number;
};

const DEFAULT_GOALS: UserGoals = {
  preset: 'maintain',
  calories: 2200,
  protein: 150,
  carbs: 220,
  fat: 70,
};

export type MealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export function autoDetectPeriod(date = new Date()): MealPeriod {
  const h = date.getHours();
  if (h >= 5  && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 15 && h < 21) return 'dinner';
  return 'snacks';
}

export function periodFromTimestamp(ts: string): MealPeriod {
  return autoDetectPeriod(new Date(ts));
}

export type MacroItem = {
  name: string;
  portion: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  // Optional structured quantity fields — absent on older logged meals
  quantity?: number;
  unit?: string;
  count?: number;
  sizeDescription?: string;
  servingDescription?: string;
};

export type LoggedMeal = {
  id: string;
  timestamp: string;
  period?: MealPeriod;   // optional for backward-compat; inferred from timestamp if absent
  items: MacroItem[];
  totals: { cal: number; protein: number; carbs: number; fat: number };
};

export type ExerciseEntry = {
  id: string;
  name: string;
  duration: number;
  type: 'cardio' | 'strength' | 'other';
  caloriesBurned: number;
};

function round1(n: number) { return Math.round(n * 10) / 10; }

type MealContextType = {
  mealLog: LoggedMeal[];
  addMeal: (meal: LoggedMeal) => void;
  updateMealItem: (mealId: string, itemIndex: number, updated: MacroItem) => void;
  deleteMeal: (mealId: string) => void;
  deleteMealItem: (mealId: string, itemIndex: number) => void;
  goals: UserGoals;
  setGoals: (goals: UserGoals) => void;
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  periodLabel: string;
  setPeriodLabel: (label: string) => void;
  venue: Venue | null;
  setVenue: (venue: Venue | null) => void;
  waterCups: number;
  toggleWater: (index: number) => void;
  exerciseLog: ExerciseEntry[];
  addExercise: (entry: Omit<ExerciseEntry, 'id'>) => void;
  totalBurned: number;
  resetDayStats: () => void;
};

const MealContext = createContext<MealContextType>({
  mealLog: [],
  addMeal: () => {},
  updateMealItem: () => {},
  deleteMeal: () => {},
  deleteMealItem: () => {},
  goals: DEFAULT_GOALS,
  setGoals: () => {},
  menuItems: FAKE_MENU,
  setMenuItems: () => {},
  periodLabel: 'Dinner',
  setPeriodLabel: () => {},
  venue: null,
  setVenue: () => {},
  waterCups: 0,
  toggleWater: () => {},
  exerciseLog: [],
  addExercise: () => {},
  totalBurned: 0,
  resetDayStats: () => {},
});

export function MealProvider({ children }: { children: ReactNode }) {
  const [mealLog, setMealLog] = useState<LoggedMeal[]>([]);
  const [goals, setGoalsState] = useState<UserGoals>(DEFAULT_GOALS);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(FAKE_MENU);
  const [periodLabel, setPeriodLabel] = useState('Dinner');
  const [venue, setVenue] = useState<Venue | null>(null);
  const today = new Date().toDateString();
  const waterKey = `@dininglens_water_${today}`;
  const exerciseKey = `@dininglens_exercise_${today}`;
  const [waterCups, setWaterCups] = useState(0);
  const [exerciseLog, setExerciseLog] = useState<ExerciseEntry[]>([]);

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

  useEffect(() => {
    AsyncStorage.getItem(waterKey)
      .then(v => setWaterCups(v ? parseInt(v) : 0))
      .catch(() => {});
    AsyncStorage.getItem(exerciseKey)
      .then(raw => {
        if (raw) try { setExerciseLog(JSON.parse(raw)); } catch {}
        else setExerciseLog([]);
      })
      .catch(() => {});
  }, [waterKey, exerciseKey]);

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

  function deleteMeal(mealId: string) {
    setMealLog(prev => {
      const next = prev.filter(m => m.id !== mealId);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function deleteMealItem(mealId: string, itemIndex: number) {
    setMealLog(prev => {
      const next = prev
        .map(meal => {
          if (meal.id !== mealId) return meal;
          const newItems = meal.items.filter((_, i) => i !== itemIndex);
          if (newItems.length === 0) return null;
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
        })
        .filter((m): m is LoggedMeal => m !== null);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function toggleWater(index: number) {
    setWaterCups(prev => {
      const next = index < prev ? index : index + 1;
      AsyncStorage.setItem(waterKey, String(next)).catch(() => {});
      return next;
    });
  }

  function addExercise(entry: Omit<ExerciseEntry, 'id'>) {
    const full: ExerciseEntry = { ...entry, id: String(Date.now()) };
    setExerciseLog(prev => {
      const next = [...prev, full];
      AsyncStorage.setItem(exerciseKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function resetDayStats() {
    setWaterCups(0);
    setExerciseLog([]);
    AsyncStorage.removeItem(waterKey).catch(() => {});
    AsyncStorage.removeItem(exerciseKey).catch(() => {});
  }

  const totalBurned = exerciseLog.reduce((a, e) => a + e.caloriesBurned, 0);

  return (
    <MealContext.Provider
      value={{
        mealLog,
        addMeal,
        updateMealItem,
        deleteMeal,
        deleteMealItem,
        goals,
        setGoals,
        menuItems,
        setMenuItems,
        periodLabel,
        setPeriodLabel,
        venue,
        setVenue,
        waterCups,
        toggleWater,
        exerciseLog,
        addExercise,
        totalBurned,
        resetDayStats,
      }}
    >
      {children}
    </MealContext.Provider>
  );
}

export function useMealContext() {
  return useContext(MealContext);
}
