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

export type MenuResult = { items: MenuItem[]; periodLabel: string };

// Matches the server's /analyze menuItems cap; larger payloads are rejected with 400.
export const MAX_MENU_ITEMS = 200;
const MENU_FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MENU_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function capMenu(items: MenuItem[]): MenuItem[] {
  const seen = new Set<string>();
  const unique: MenuItem[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...item, name: item.name.slice(0, 200) });
    if (unique.length >= MAX_MENU_ITEMS) break;
  }
  return unique;
}

const PERIOD_ALIASES: Record<string, string[]> = {
  breakfast: ['breakfast', 'brunch', 'morning'],
  lunch:     ['lunch', 'brunch', 'midday'],
  dinner:    ['dinner', 'supper', 'late night', 'late-night', 'evening'],
};

function matchPeriod(periods: any[], slug: string): any | null {
  const aliases = PERIOD_ALIASES[slug] ?? [slug];
  for (const alias of aliases) {
    const hit = periods.find(
      (p: any) => p?.slug === alias || String(p?.name ?? '').toLowerCase().includes(alias)
    );
    if (hit) return hit;
  }
  return periods.length === 1 ? periods[0] : null;
}

/**
 * Fetch the menu for a given dineoncampus location and date, for the current
 * meal period. Returns null when the menu cannot be loaded — callers must show
 * "menu unavailable" rather than substituting placeholder food.
 *
 * @param date  local YYYY-MM-DD (use toDateKey, not toISOString)
 */
export async function fetchMenu(locationId: string, date: string): Promise<MenuResult | null> {
  const { slug, label } = getCurrentPeriod();

  try {
    const periodsRes = await fetchWithTimeout(
      `${BASE_URL}/locations/${locationId}/periods/?date=${date}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!periodsRes.ok) return null;

    const periodsData = await periodsRes.json();
    const periods: any[] = periodsData?.periods ?? (Array.isArray(periodsData) ? periodsData : []);

    const matched = matchPeriod(periods, slug);
    if (!matched) return null;

    const menuRes = await fetchWithTimeout(
      `${BASE_URL}/locations/${locationId}/periods/?date=${date}&period_id=${matched.id}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!menuRes.ok) return null;

    const items = capMenu(parseItems(await menuRes.json()));
    if (items.length === 0) return null;
    return { items, periodLabel: typeof matched.name === 'string' ? matched.name : label };
  } catch {
    return null;
  }
}

export async function fetchVenueMenu(
  venue: { provider: DiningProvider | 'generic'; locationId: string },
  date: string
): Promise<MenuResult | null> {
  if (venue.provider === 'dineoncampus') return fetchMenu(venue.locationId, date);
  if (venue.provider === 'cs50') return fetchCs50Menu(venue.locationId, date);
  return null;
}

async function fetchCs50Menu(locationId: string, date: string): Promise<MenuResult | null> {
  const { mealId, label: periodLabel } = getCurrentCs50Meal();

  try {
    const res = await fetchWithTimeout(
      `${CS50_BASE_URL}/menus?date=${date}&location=${encodeURIComponent(locationId)}&meal=${mealId}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const recipeIds = [...new Set(
      (Array.isArray(data) ? data : [])
        .map((item: any) => item?.recipe)
        .filter((id: any) => id != null)
    )].slice(0, 40);

    const recipes = await Promise.all(
      recipeIds.map(async id => {
        try {
          const recipeRes = await fetchWithTimeout(`${CS50_BASE_URL}/recipes/${encodeURIComponent(String(id))}`);
          if (!recipeRes.ok) return null;
          return recipeRes.json();
        } catch {
          return null;
        }
      })
    );

    const items: MenuItem[] = capMenu(recipes
      .filter((recipe: any) => recipe?.name)
      .map((recipe: any) => ({
        id: String(recipe.id),
        name: recipe.name,
        calories: Math.round(recipe.calories ?? 0),
        protein: Math.round(parseGramAmount(recipe.protein) * 10) / 10,
        carbs: Math.round(parseGramAmount(recipe.total_carb) * 10) / 10,
        fat: Math.round(parseGramAmount(recipe.total_fat) * 10) / 10,
      })));

    return items.length > 0 ? { items, periodLabel } : null;
  } catch {
    return null;
  }
}
