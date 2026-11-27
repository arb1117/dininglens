import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import { MenuItem } from '../services/menuService';
import { Venue } from '../services/venueService';
import { STORAGE_KEYS, toDateKey } from '../storage/storageKeys';
import { getJSON, setJSON, removeKey } from '../storage/storageClient';
import { migrateStorageIfNeeded } from '../storage/migrations';
import { sanitizeArray, sanitizeMeal, sanitizeGoals, sanitizeExerciseEntry } from '../storage/storageValidation';

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

export type { MealPeriod, MacroItem, NutritionTotals, FoodItem, VenueMetadata } from '../types/nutrition';
import type { MealPeriod, MacroItem, NutritionTotals } from '../types/nutrition';

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

export type LoggedMeal = {
  id: string;
  timestamp: string;
  period?: MealPeriod;   // optional for backward-compat; inferred from timestamp if absent
  items: MacroItem[];
  totals: NutritionTotals;
  venueId?: string;
  placeId?: string;
  venueName?: string;
  source?: 'camera' | 'manual' | 'barcode' | 'saved';
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
  resetAllState: () => void;
  // Local YYYY-MM-DD; changes at midnight so consumers re-render into the new day.
  todayKey: string;
};

const MealContext = createContext<MealContextType>({
  mealLog: [],
  addMeal: () => {},
  updateMealItem: () => {},
  deleteMeal: () => {},
  deleteMealItem: () => {},
  goals: DEFAULT_GOALS,
  setGoals: () => {},
  menuItems: [],
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
  resetAllState: () => {},
  todayKey: toDateKey(new Date()),
});

export function MealProvider({ children }: { children: ReactNode }) {
  const [mealLog, setMealLog] = useState<LoggedMeal[]>([]);
  const [goals, setGoalsState] = useState<UserGoals>(DEFAULT_GOALS);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [periodLabel, setPeriodLabel] = useState('Dinner');
  const [venue, setVenue] = useState<Venue | null>(null);
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const hydrated = useRef(false);
  const waterKey = STORAGE_KEYS.WATER(dateKey);
  const exerciseKey = STORAGE_KEYS.EXERCISE(dateKey);
  const [waterCups, setWaterCups] = useState(0);
  const [exerciseLog, setExerciseLog] = useState<ExerciseEntry[]>([]);

  useEffect(() => {
    async function init() {
      await migrateStorageIfNeeded();
      const meals = await getJSON<unknown>(STORAGE_KEYS.MEAL_LOG, [], v => Array.isArray(v));
      const stored = sanitizeArray(meals, sanitizeMeal);
      // Meals logged before hydration finished are merged in front of stored
      // history rather than overwriting it.
      setMealLog(prev => {
        const storedIds = new Set(stored.map(m => m.id));
        const merged = [...prev.filter(m => !storedIds.has(m.id)), ...stored];
        hydrated.current = true;
        if (prev.length > 0) setJSON(STORAGE_KEYS.MEAL_LOG, merged);
        return merged;
      });
      const g = await getJSON<unknown>(STORAGE_KEYS.GOALS, null);
      const cleanGoals = sanitizeGoals(g);
      if (cleanGoals) setGoalsState(cleanGoals);
    }
    init().catch(() => { hydrated.current = true; });
  }, []);

  useEffect(() => {
    const refresh = () => setDateKey(prev => {
      const now = toDateKey(new Date());
      return now === prev ? prev : now;
    });
    const interval = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(interval); sub.remove(); };
  }, []);

  function persistMeals(next: LoggedMeal[]) {
    if (hydrated.current) setJSON(STORAGE_KEYS.MEAL_LOG, next);
  }

  useEffect(() => {
    getJSON<number>(waterKey, 0, v => typeof v === 'number')
      .then(n => setWaterCups(typeof n === 'number' && n >= 0 ? Math.min(n, 20) : 0))
      .catch(() => {});
    getJSON<unknown>(exerciseKey, [], v => Array.isArray(v))
      .then(entries => setExerciseLog(sanitizeArray(entries, sanitizeExerciseEntry)))
      .catch(() => {});
  }, [waterKey, exerciseKey]);

  function setGoals(g: UserGoals) {
    setGoalsState(g);
  }

  function addMeal(meal: LoggedMeal) {
    setMealLog(prev => {
      const next = [meal, ...prev];
      persistMeals(next);
      setJSON(STORAGE_KEYS.LAST_LOGGED, new Date().toDateString());
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
      persistMeals(next);
      return next;
    });
  }

  function deleteMeal(mealId: string) {
    setMealLog(prev => {
      const next = prev.filter(m => m.id !== mealId);
      persistMeals(next);
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
      persistMeals(next);
      return next;
    });
  }

  function toggleWater(index: number) {
    setWaterCups(prev => {
      const next = index < prev ? index : index + 1;
      setJSON(waterKey, next);
      return next;
    });
  }

  function addExercise(entry: Omit<ExerciseEntry, 'id'>) {
    const full: ExerciseEntry = { ...entry, id: String(Date.now()) };
    setExerciseLog(prev => {
      const next = [...prev, full];
      setJSON(exerciseKey, next);
      return next;
    });
  }

  function resetAllState() {
    setMealLog([]);
    setGoalsState(DEFAULT_GOALS);
    setMenuItems([]);
    setVenue(null);
    setWaterCups(0);
    setExerciseLog([]);
  }

  function resetDayStats() {
    setWaterCups(0);
    setExerciseLog([]);
    removeKey(waterKey);
    removeKey(exerciseKey);
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
        resetAllState,
        todayKey: dateKey,
      }}
    >
      {children}
    </MealContext.Provider>
  );
}

export function useMealContext() {
  return useContext(MealContext);
}
