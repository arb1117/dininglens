import {
  calculateBMR,
  calculateTDEE,
  calculateDailyCalories,
  calculateMacros,
  parseGoalInput,
} from './nutritionCalculator';

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('matches the male formula', () => {
    expect(calculateBMR(80, 180, 25, 'male')).toBe(10 * 80 + 6.25 * 180 - 5 * 25 + 5);
  });
  it('matches the female formula', () => {
    expect(calculateBMR(60, 165, 30, 'female')).toBe(10 * 60 + 6.25 * 165 - 5 * 30 - 161);
  });
});

describe('calculateTDEE', () => {
  it('applies the activity multiplier and rounds', () => {
    expect(calculateTDEE(1744, 'sedentary')).toBe(Math.round(1744 * 1.2));
  });
});

describe('calculateDailyCalories', () => {
  it('subtracts 500 for fat loss but respects the floor', () => {
    expect(calculateDailyCalories(2500, 'lose_fat', 'male')).toBe(2000);
    expect(calculateDailyCalories(1600, 'lose_fat', 'female')).toBe(1200);
    expect(calculateDailyCalories(1800, 'lose_fat', 'male')).toBe(1500);
  });
  it('adds 300 for muscle gain', () => {
    expect(calculateDailyCalories(2500, 'gain_muscle', 'male')).toBe(2800);
  });
});

describe('calculateMacros', () => {
  it('caps protein for very heavy users', () => {
    const { protein } = calculateMacros(2500, 400, 'lose_fat');
    expect(protein).toBeLessThanOrEqual(240);
    expect(protein * 4).toBeLessThanOrEqual(2500 * 0.4);
  });
  it('never returns negative carbs', () => {
    expect(calculateMacros(1200, 240, 'recomposition').carbs).toBeGreaterThanOrEqual(0);
  });
});

describe('parseGoalInput', () => {
  it('uses the fallback for blank input', () => {
    expect(parseGoalInput('', 150)).toBe(150);
    expect(parseGoalInput('   ', 150)).toBe(150);
  });
  it('keeps an explicit zero', () => {
    expect(parseGoalInput('0', 220)).toBe(0);
  });
  it('parses numbers', () => {
    expect(parseGoalInput('180', 150)).toBe(180);
  });
  it('falls back for junk or negative input', () => {
    expect(parseGoalInput('abc', 70)).toBe(70);
    expect(parseGoalInput('-5', 70)).toBe(70);
  });
});
