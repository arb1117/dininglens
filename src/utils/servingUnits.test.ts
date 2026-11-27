import {
  parseQuantity,
  parseGramWeight,
  parseMlVolume,
  getUnitOptions,
  computeServingMultiplier,
} from './servingUnits';

describe('parseQuantity', () => {
  it.each([
    ['2', 2],
    ['2.5', 2.5],
    ['3/4', 0.75],
    ['1 1/2', 1.5],
  ])('%s → %d', (raw, expected) => {
    expect(parseQuantity(raw)).toBeCloseTo(expected);
  });
});

describe('parseGramWeight', () => {
  it('reads grams', () => expect(parseGramWeight('1 cup (30g)')).toBe(30));
  it('reads grams with a space', () => expect(parseGramWeight('2 slices (56 g)')).toBe(56));
  it('converts ounces', () => expect(parseGramWeight('4 oz')).toBeCloseTo(113.4));
  it('does not treat fl oz as weight', () => expect(parseGramWeight('8 fl oz')).toBeNull());
  it('returns null without a weight', () => expect(parseGramWeight('1 serving')).toBeNull());
});

describe('parseMlVolume', () => {
  it('reads ml in any case', () => {
    expect(parseMlVolume('250 mL')).toBe(250);
    expect(parseMlVolume('355ML')).toBe(355);
  });
  it('converts fl oz', () => expect(parseMlVolume('8 fl oz')).toBeCloseTo(236.56));
  it('reads household cups', () => expect(parseMlVolume('1 cup (30g)')).toBe(240));
  it('reads fractional cups', () => expect(parseMlVolume('3/4 cup')).toBe(180));
  it('reads mixed-number cups', () => expect(parseMlVolume('1 1/2 cups')).toBe(360));
  it('reads tablespoons', () => expect(parseMlVolume('2 tbsp (32g)')).toBe(30));
  it('reads teaspoons', () => expect(parseMlVolume('1 teaspoon')).toBe(5));
  it('returns null for gram-only servings', () => expect(parseMlVolume('100g')).toBeNull());
});

describe('getUnitOptions', () => {
  it('offers no volume units for gram-only servings', () => {
    const opts = getUnitOptions('100g');
    expect(opts).toEqual(expect.arrayContaining(['serving', 'g', 'oz']));
    expect(opts).not.toContain('cup');
  });
  it('offers both when the serving lists volume and weight', () => {
    expect(getUnitOptions('1 cup (30g)')).toEqual(expect.arrayContaining(['g', 'oz', 'cup', 'tbsp', 'ml']));
  });
  it('offers only generic units when nothing is parseable', () => {
    expect(getUnitOptions('1 serving')).toEqual(['serving', 'piece', 'slice', 'scoop']);
  });
});

describe('computeServingMultiplier', () => {
  it('scales grams against the serving weight', () => {
    expect(computeServingMultiplier(60, 'g', 30, null)).toBe(2);
  });
  it('converts cups using the serving volume, not water density', () => {
    // Cereal: 1 cup = 30 g. Half a cup is half a serving regardless of grams.
    expect(computeServingMultiplier(0.5, 'cup', 30, 240)).toBe(0.5);
  });
  it('converts tbsp against a cup-sized serving', () => {
    expect(computeServingMultiplier(4, 'tbsp', null, 240)).toBe(0.25);
  });
  it('treats serving-like units as a count', () => {
    expect(computeServingMultiplier(3, 'piece', 30, 240)).toBe(3);
  });
  it('returns 0 for non-positive amounts', () => {
    expect(computeServingMultiplier(0, 'g', 30, null)).toBe(0);
    expect(computeServingMultiplier(-1, 'g', 30, null)).toBe(0);
  });
});
