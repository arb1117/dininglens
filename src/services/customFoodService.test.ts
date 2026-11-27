jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveCustomFood, listCustomFoods } from './customFoodService';

const base = { servingSize: '1 serving', protein: 10, carbs: 20, fat: 5, source: 'manual' as const };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('saveCustomFood', () => {
  it('updates one entry when the same food is logged again', async () => {
    const first = await saveCustomFood({ ...base, name: 'Protein Shake', calories: 200 });
    const second = await saveCustomFood({ ...base, name: '  protein   shake ', calories: 220 });

    const foods = await listCustomFoods();
    expect(foods).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(foods[0].useCount).toBe(2);
    expect(foods[0].calories).toBe(220);
  });

  it('keeps foods with different brands separate', async () => {
    await saveCustomFood({ ...base, name: 'Granola Bar', calories: 190, brand: 'Nature Valley' });
    await saveCustomFood({ ...base, name: 'Granola Bar', calories: 140, brand: 'Kind' });
    expect(await listCustomFoods()).toHaveLength(2);
  });

  it('keeps different foods separate', async () => {
    await saveCustomFood({ ...base, name: 'Bagel', calories: 280 });
    await saveCustomFood({ ...base, name: 'Bagel with cream cheese', calories: 380 });
    expect(await listCustomFoods()).toHaveLength(2);
  });
});
