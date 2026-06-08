export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active';

export type BodyGoal = 'lose_fat' | 'maintain' | 'gain_muscle' | 'recomposition';

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
  extremely_active: 'Extremely Active',
};

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: 'Little or no exercise, desk job',
  lightly_active: 'Light exercise 1–3 days/week',
  moderately_active: 'Moderate exercise 3–5 days/week',
  very_active: 'Hard exercise 6–7 days/week',
  extremely_active: 'Very hard exercise, physical job, or 2x training',
};

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'male' | 'female' | 'other'
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // average: (5 + -161) / 2 = -78
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calculateDailyCalories(
  tdee: number,
  goal: BodyGoal,
  sex: 'male' | 'female' | 'other'
): number {
  switch (goal) {
    case 'lose_fat': {
      const minCal = sex === 'female' ? 1200 : 1500;
      return Math.max(Math.round(tdee - 500), minCal);
    }
    case 'maintain':
      return tdee;
    case 'gain_muscle':
      return tdee + 300;
    case 'recomposition':
      return Math.round(tdee - 200);
  }
}

export function calculateMacros(
  calories: number,
  weightLbs: number,
  goal: BodyGoal
): { protein: number; fat: number; carbs: number } {
  let proteinPerLb: number;
  let fatCalPercent: number;

  switch (goal) {
    case 'lose_fat':
      proteinPerLb = 1.0;
      fatCalPercent = 0.25;
      break;
    case 'maintain':
      proteinPerLb = 0.8;
      fatCalPercent = 0.30;
      break;
    case 'gain_muscle':
      proteinPerLb = 1.0;
      fatCalPercent = 0.25;
      break;
    case 'recomposition':
      proteinPerLb = 1.1;
      fatCalPercent = 0.25;
      break;
  }

  const proteinGrams = Math.round(weightLbs * proteinPerLb);
  const proteinCals = proteinGrams * 4;
  const fatGrams = Math.round((calories * fatCalPercent) / 9);
  const fatCals = fatGrams * 9;
  const carbCals = Math.max(0, calories - proteinCals - fatCals);
  const carbGrams = Math.round(carbCals / 4);

  return { protein: proteinGrams, fat: fatGrams, carbs: carbGrams };
}

export type NutritionProfile = {
  weightKg: number;
  weightLbs: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female' | 'other';
  activityLevel: ActivityLevel;
  bodyGoal: BodyGoal;
};

export function calculateAll(profile: NutritionProfile): {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  bmr: number;
  tdee: number;
} {
  const bmr = calculateBMR(profile.weightKg, profile.heightCm, profile.age, profile.sex);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const calories = calculateDailyCalories(tdee, profile.bodyGoal, profile.sex);
  const macros = calculateMacros(calories, profile.weightLbs, profile.bodyGoal);
  return { calories, ...macros, bmr: Math.round(bmr), tdee };
}

type ActivityEstimationParams = {
  dailySteps?: number;
  workoutsPerWeek?: number;
  workoutIntensity?: 'light' | 'moderate' | 'intense';
  jobType?: 'desk' | 'lightly_active' | 'very_active';
  description?: string;
};

export function estimateActivityLevel(params: ActivityEstimationParams): ActivityLevel {
  const { dailySteps, workoutsPerWeek, workoutIntensity, jobType, description } = params;
  const LEVELS: ActivityLevel[] = [
    'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active',
  ];
  let idx = 0;

  if (workoutsPerWeek !== undefined) {
    if (workoutsPerWeek >= 5) idx = Math.max(idx, 3);
    else if (workoutsPerWeek >= 3) idx = Math.max(idx, 2);
    else if (workoutsPerWeek >= 1) idx = Math.max(idx, 1);
  }

  if (dailySteps !== undefined) {
    if (dailySteps > 10000) idx = Math.min(idx + 1, 4);
    else if (dailySteps > 7000) idx = Math.max(idx, 1);
  }

  if (workoutIntensity === 'intense') idx = Math.min(idx + 1, 4);
  if (jobType === 'very_active') idx = Math.min(idx + 1, 4);

  const hasStructured = dailySteps !== undefined || workoutsPerWeek !== undefined;
  if (!hasStructured && description) {
    const lower = description.toLowerCase();
    if (/athlete|twice a day|2x train/.test(lower)) idx = Math.max(idx, 4);
    else if (/very active|run.*every|train daily/.test(lower)) idx = Math.max(idx, 3);
    else if (/gym|workout|exercise|lift|run|bike|swim/.test(lower)) idx = Math.max(idx, 2);
    else if (/walk|light|occasional|few times/.test(lower)) idx = Math.max(idx, 1);
    else if (/sedentary|desk|mostly sit|not active|rarely/.test(lower)) idx = 0;
  }

  return LEVELS[Math.min(idx, 4)];
}

export function goalKeyToBodyGoal(key: 'lose' | 'maintain' | 'build' | 'recomposition'): BodyGoal {
  const map: Record<string, BodyGoal> = {
    lose: 'lose_fat',
    maintain: 'maintain',
    build: 'gain_muscle',
    recomposition: 'recomposition',
  };
  return map[key] ?? 'maintain';
}
