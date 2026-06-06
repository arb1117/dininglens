import { SUPPORTED_DINING_VENUES } from '../data/campuses';
import type { DiningProvider } from '../data/campuses';

const BASE_URL = 'https://apiv4.dineoncampus.com';
const CS50_BASE_URL = 'https://api.cs50.io/dining';

export type MenuItem = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Map of venue names → dineoncampus location IDs. Add new schools here. */
export const KNOWN_LOCATIONS: Record<string, string> = Object.fromEntries(
  SUPPORTED_DINING_VENUES
    .filter(venue => venue.provider === 'dineoncampus')
    .map(venue => [venue.name, venue.locationId])
);

export const FAKE_MENU: MenuItem[] = [
  { id: 'fake-1', name: 'Grilled Chicken Breast', calories: 165, protein: 31, carbs: 0,  fat: 3.6 },
  { id: 'fake-2', name: 'White Rice',             calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: 'fake-3', name: 'Green Beans',            calories: 35,  protein: 1.8, carbs: 8,  fat: 0.2 },
  { id: 'fake-4', name: 'Mac and Cheese',         calories: 310, protein: 10,  carbs: 44, fat: 11  },
  { id: 'fake-5', name: 'Turkey Burger',          calories: 270, protein: 22,  carbs: 24, fat: 9   },
];

function getCurrentPeriod(): { slug: string; label: string } {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 10 * 60 + 30) return { slug: 'breakfast', label: 'Breakfast' };
  if (mins < 15 * 60)       return { slug: 'lunch',     label: 'Lunch'     };
  return                              { slug: 'dinner',   label: 'Dinner'    };
}

function getCurrentCs50Meal(): { mealId: number; label: string } {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 10 * 60 + 30) return { mealId: 0, label: 'Breakfast' };
  if (mins < 15 * 60) return { mealId: 1, label: 'Lunch' };
  return { mealId: 2, label: 'Dinner' };
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
      const foods: any[] = entry?.items ?? [entry];
      for (const food of foods) {
        if (!food?.name || !Array.isArray(food?.nutrients)) continue;
        items.push({
          id:       food.id ?? `item-${items.length}`,
          name:     food.name,
          calories: parseNutrient(food.nutrients, 'Calories'),
          protein:  parseNutrient(food.nutrients, 'Protein (g)'),
          carbs:    parseNutrient(food.nutrients, 'Total Carbohydrates (g)'),
          fat:      parseNutrient(food.nutrients, 'Total Fat (g)'),
        });
      }
    }
  }
  return items;
}

function parseGramAmount(value: any): number {
  if (!value?.amount) return 0;
  const n = parseFloat(String(value.amount).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fetch the menu for a given dineoncampus location and date.
 * Automatically selects the current meal period.
 * Falls back to FAKE_MENU on any error or empty response.
 *
 * @param locationId  dineoncampus location ID (see KNOWN_LOCATIONS)
 * @param date        ISO date string, e.g. "2026-06-05"
 */
export async function fetchMenu(
  locationId: string,
  date: string
): Promise<{ items: MenuItem[]; periodLabel: string }> {
  const { slug, label: periodLabel } = getCurrentPeriod();

  try {
    const periodsRes = await fetch(
      `${BASE_URL}/locations/${locationId}/periods/?date=${date}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!periodsRes.ok) throw new Error(`periods ${periodsRes.status}`);

    const periodsData = await periodsRes.json();
    const periods: any[] = periodsData?.periods ?? periodsData ?? [];

    const matched = periods.find(
      (p: any) => p.slug === slug || p.name?.toLowerCase().includes(slug)
    );
    if (!matched) return { items: FAKE_MENU, periodLabel };

    const menuRes = await fetch(
      `${BASE_URL}/locations/${locationId}/periods/?date=${date}&period_id=${matched.id}`,
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

export async function fetchVenueMenu(
  venue: { provider: DiningProvider | 'generic'; locationId: string },
  date: string
): Promise<{ items: MenuItem[]; periodLabel: string }> {
  if (venue.provider === 'dineoncampus') {
    return fetchMenu(venue.locationId, date);
  }

  if (venue.provider === 'cs50') {
    return fetchCs50Menu(venue.locationId, date);
  }

  return { items: FAKE_MENU, periodLabel: 'Menu' };
}

async function fetchCs50Menu(
  locationId: string,
  date: string
): Promise<{ items: MenuItem[]; periodLabel: string }> {
  const { mealId, label: periodLabel } = getCurrentCs50Meal();

  try {
    const res = await fetch(
      `${CS50_BASE_URL}/menus?date=${date}&location=${encodeURIComponent(locationId)}&meal=${mealId}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(`cs50 menus ${res.status}`);

    const data = await res.json();
    const recipeIds = [...new Set(
      (Array.isArray(data) ? data : [])
        .map((item: any) => item?.recipe)
        .filter((id: any) => id != null)
    )].slice(0, 40);

    const recipes = await Promise.all(
      recipeIds.map(async id => {
        try {
          const recipeRes = await fetch(`${CS50_BASE_URL}/recipes/${encodeURIComponent(String(id))}`);
          if (!recipeRes.ok) return null;
          return recipeRes.json();
        } catch {
          return null;
        }
      })
    );

    const items: MenuItem[] = recipes
      .filter((recipe: any) => recipe?.name)
      .map((recipe: any) => ({
        id: String(recipe.id),
        name: recipe.name,
        calories: Math.round(recipe.calories ?? 0),
        protein: Math.round(parseGramAmount(recipe.protein) * 10) / 10,
        carbs: Math.round(parseGramAmount(recipe.total_carb) * 10) / 10,
        fat: Math.round(parseGramAmount(recipe.total_fat) * 10) / 10,
      }));

    return { items: items.length > 0 ? items : FAKE_MENU, periodLabel };
  } catch {
    return { items: FAKE_MENU, periodLabel };
  }
}
