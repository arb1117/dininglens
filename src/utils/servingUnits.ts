export const ML_PER_UNIT = { cup: 240, tbsp: 15, tsp: 5 } as const;

const GRAMS_PER_OZ = 28.35;
const ML_PER_FL_OZ = 29.57;

// "1 1/2", "3/4", "2.5" → number
export function parseQuantity(raw: string): number {
  const parts = raw.trim().split(/\s+/);
  return parts.reduce((sum, part) => {
    const [num, den] = part.split('/').map(Number);
    return sum + (den ? num / den : num);
  }, 0);
}

export function parseGramWeight(servingSize: string): number | null {
  const gm = servingSize.match(/(\d+\.?\d*)\s*g\b/i);
  if (gm) return parseFloat(gm[1]);
  const oz = servingSize.match(/(\d+\.?\d*)\s*oz\b/i);
  if (oz) return parseFloat(oz[1]) * GRAMS_PER_OZ;
  return null;
}

// Volume units need a known volume per serving: converting cups to grams assumes a
// density, and 240 g per cup is only true for water-like foods.
export function parseMlVolume(servingSize: string): number | null {
  const ml = servingSize.match(/(\d+\.?\d*)\s*ml\b/i);
  if (ml) return parseFloat(ml[1]);
  const floz = servingSize.match(/(\d+\.?\d*)\s*fl\.?\s*oz/i);
  if (floz) return parseFloat(floz[1]) * ML_PER_FL_OZ;
  const household = servingSize.match(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)\s*(cups?|tbsps?|tablespoons?|tsps?|teaspoons?)\b/i);
  if (household) {
    const qty = parseQuantity(household[1]);
    const u = household[2].toLowerCase();
    const perUnit = u.startsWith('c') ? ML_PER_UNIT.cup
      : u.startsWith('tb') || u.startsWith('table') ? ML_PER_UNIT.tbsp
      : ML_PER_UNIT.tsp;
    if (qty > 0) return qty * perUnit;
  }
  return null;
}

export function getUnitOptions(servingSize: string): string[] {
  const opts = ['serving'];
  if (parseGramWeight(servingSize)) opts.push('g', 'oz');
  if (parseMlVolume(servingSize)) opts.push('ml', 'fl oz', 'cup', 'tbsp', 'tsp');
  opts.push('piece', 'slice', 'scoop');
  return opts;
}

// How many listed servings `n` of unit `u` equals, given the serving's gram weight and volume.
export function computeServingMultiplier(n: number, u: string, gw: number | null, ml: number | null): number {
  if (n <= 0) return 0;
  switch (u) {
    case 'g':     return gw ? n / gw : n;
    case 'oz':    return gw ? (n * GRAMS_PER_OZ) / gw : n;
    case 'ml':    return ml ? n / ml : n;
    case 'fl oz': return ml ? (n * ML_PER_FL_OZ) / ml : n;
    case 'cup':
    case 'tbsp':
    case 'tsp':   return ml ? (n * ML_PER_UNIT[u]) / ml : n;
    default:      return n; // serving, piece, slice, scoop
  }
}
