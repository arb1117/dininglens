const LOCATION_ID = '5878eb5cee596f847636f114';
const BASE_URL = 'https://apiv4.dineoncampus.com';

export type MenuItem = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const FAKE_MENU: MenuItem[] = [
  { id: 'fake-1', name: 'Grilled Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'fake-2', name: 'White Rice', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: 'fake-3', name: 'Green Beans', calories: 35, protein: 1.8, carbs: 8, fat: 0.2 },
  { id: 'fake-4', name: 'Mac and Cheese', calories: 310, protein: 10, carbs: 44, fat: 11 },
  { id: 'fake-5', name: 'Turkey Burger', calories: 270, protein: 22, carbs: 24, fat: 9 },
];

function getCurrentPeriod(): { slug: string; label: string } {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 10 * 60 + 30) return { slug: 'breakfast', label: 'Breakfast' };
  if (mins < 15 * 60) return { slug: 'lunch', label: 'Lunch' };
  return { slug: 'dinner', label: 'Dinner' };
}

function parseNutrient(nutrients: any[], name: string): number {
  const n = nutrients?.find((x: any) => x.name === name);
  return n ? parseFloat(n.value) || 0 : 0;
}

function parseItems(data: any): MenuItem[] {
  const stations: any[] =
    data?.menu?.periods?.food ??
    data?.menu?.stations ??
    data?.stations ??
    [];

  const items: MenuItem[] = [];
  for (const station of stations) {
    for (const entry of station?.items ?? []) {
      // Items may be nested under a category or flat
      const foods: any[] = entry?.items ?? [entry];
      for (const food of foods) {
        if (!food?.name || !Array.isArray(food?.nutrients)) continue;
        items.push({
          id: food.id ?? `item-${items.length}`,
          name: food.name,
          calories: parseNutrient(food.nutrients, 'Calories'),
          protein: parseNutrient(food.nutrients, 'Protein (g)'),
          carbs: parseNutrient(food.nutrients, 'Total Carbohydrates (g)'),
          fat: parseNutrient(food.nutrients, 'Total Fat (g)'),
        });
      }
    }
  }
  return items;
}

export async function fetchMenu(): Promise<{ items: MenuItem[]; periodLabel: string }> {
  const { slug, label: periodLabel } = getCurrentPeriod();

  try {
    const date = new Date().toISOString().split('T')[0];

    const periodsRes = await fetch(
      `${BASE_URL}/locations/${LOCATION_ID}/periods/?date=${date}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!periodsRes.ok) throw new Error(`periods ${periodsRes.status}`);

    const periodsData = await periodsRes.json();
    const periods: any[] = periodsData?.periods ?? periodsData ?? [];

    const matched = periods.find(
      (p: any) =>
        p.slug === slug ||
        p.name?.toLowerCase().includes(slug)
    );
    if (!matched) return { items: FAKE_MENU, periodLabel };

    const menuRes = await fetch(
      `${BASE_URL}/locations/${LOCATION_ID}/periods/?date=${date}&period_id=${matched.id}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!menuRes.ok) throw new Error(`menu ${menuRes.status}`);

    const menuData = await menuRes.json();
    const items = parseItems(menuData);

    return { items: items.length > 0 ? items : FAKE_MENU, periodLabel };
  } catch {
    return { items: FAKE_MENU, periodLabel };
  }
}
