require('dotenv').config();

const express = require('express');

const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.Anthropic ?? AnthropicModule.default ?? AnthropicModule;

const app = express();
app.use(express.json({ limit: '20mb' }));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractJSON(text) {
  const stripped = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in response');
  return JSON.parse(stripped.slice(start, end + 1));
}

function extractJSONArray(text) {
  const stripped = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = stripped.indexOf('[');
  const end = stripped.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found');
  return JSON.parse(stripped.slice(start, end + 1));
}

// ─── Data sources ──────────────────────────────────────────────────────────

async function searchOpenFoodFacts(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,serving_size,nutriments`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.products || [])
    .filter(p => p.product_name && p.nutriments?.['energy-kcal_serving'])
    .map(p => ({
      name: `${p.brands ? p.brands.split(',')[0].trim() + ' ' : ''}${p.product_name}`.trim(),
      serving_size: p.serving_size || '1 serving',
      calories: Math.round(p.nutriments['energy-kcal_serving'] || 0),
      protein: Math.round((p.nutriments['proteins_serving'] || 0) * 10) / 10,
      carbs: Math.round((p.nutriments['carbohydrates_serving'] || 0) * 10) / 10,
      fat: Math.round((p.nutriments['fat_serving'] || 0) * 10) / 10,
      source: 'openfoodfacts',
    }));
}

async function searchUSDA(query) {
  const key = process.env.USDA_API_KEY || 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=5&api_key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.foods || []).slice(0, 5).map(f => {
    const get = name => f.foodNutrients?.find(n => n.nutrientName === name)?.value || 0;
    return {
      name: f.description,
      serving_size: f.servingSize && f.servingSizeUnit
        ? `${f.servingSize}${f.servingSizeUnit}`
        : '100g',
      calories: Math.round(get('Energy')),
      protein: Math.round(get('Protein') * 10) / 10,
      carbs: Math.round(get('Carbohydrate, by difference') * 10) / 10,
      fat: Math.round(get('Total lipid (fat)') * 10) / 10,
      source: 'usda',
    };
  });
}

// ─── Shared prompt fragments ───────────────────────────────────────────────

const FOOD_PREAMBLE = `You are a food and nutrition analysis assistant. Your job is ONLY to identify food and beverages that appear to be part of the meal being photographed.

STRICT RULES:
- Only include items the person is clearly eating or about to eat
- Ignore all background objects (books, plates without food, containers, utensils, furniture, etc.)
- Ignore packaging, napkins, and non-food items
- If you see food AND background objects, only include the food
- Do not identify people, hands, or body parts as food items`;

const SUPPLEMENT_GUIDANCE = `For supplements, protein powders, fiber supplements, vitamins, and packaged food products:
- Identify the specific product and brand if visible on the label
- Use the ACTUAL nutrition label values if you can read the label in the image
- If you cannot read the label, use well-known database values for that specific product:
  - Optimum Nutrition Gold Standard Whey (1 scoop 30g): 120 cal, 24g protein, 3g carbs, 1.5g fat
  - Equate Psyllium Husk (2 tbsp 11g): 35 cal, 0g protein, 9g carbs, 0g fat (note: mostly fiber, minimal net carbs)
  - Psyllium husk fiber generic (1 tbsp 5g): 17 cal, 0g protein, 4g carbs, 0g fat
  - Unsweetened almond milk (240ml/8oz): 37 cal, 1g protein, 1g carbs, 3g fat
  - PHGG / Partially Hydrolyzed Guar Gum (1 serving 5g): 20 cal, 0g protein, 6g carbs, 0g fat
- For protein powders and supplements, portion size is critical — estimate based on the container/scoop visible`;

// ─── /analyze ────────────────────────────────────────────────────────────────

app.post('/analyze', async (req, res) => {
  console.log('[/analyze] request received');
  const { imageBase64, menuItems } = req.body;

  if (!imageBase64) {
    console.error('[/analyze] Missing imageBase64');
    return res.status(400).json({ error: 'imageBase64 is required' });
  }
  console.log(`[/analyze] imageBase64 length: ${imageBase64.length}, menuItems: ${menuItems?.length ?? 0}`);

  let prompt;

  if (menuItems && menuItems.length > 0) {
    const menuList = menuItems
      .map(i => `- ${i.name}: ${i.calories} cal, ${i.protein}g protein, ${i.carbs}g carbs, ${i.fat}g fat`)
      .join('\n');
    prompt = `${FOOD_PREAMBLE}

The user has photographed their meal at a dining hall.

The following items are currently on the menu:
${menuList}

Identify which of these menu items are visible in the photo and estimate the portion size.
Return ONLY valid JSON in this exact format:
{
  "detectedItems": [
    {
      "name": "item name exactly as listed above",
      "portionMultiplier": 1.0,
      "confidence": 0.9
    }
  ],
  "mode": "dining_hall"
}
Portion multiplier: 0.5 = half portion, 1.0 = normal, 1.5 = large, 2.0 = double. Only include items you can actually see.
Return ONLY the JSON object with no markdown formatting, no code fences, and no additional text before or after.`;
  } else {
    prompt = `${FOOD_PREAMBLE}

${SUPPLEMENT_GUIDANCE}

Identify all food items visible in this photo and estimate their calories and macros.
Return ONLY valid JSON in this exact format:
{
  "detectedItems": [
    {
      "name": "food name",
      "calories": 300,
      "protein": 25,
      "carbs": 20,
      "fat": 8,
      "portionMultiplier": 1.0,
      "confidence": 0.85
    }
  ],
  "mode": "generic"
}

If you cannot identify any food items, return:
{"detectedItems": [], "mode": "generic", "reason": "no_food"}

If food is present but the image is too dark, blurry, or low quality to analyze reliably, return:
{"detectedItems": [], "mode": "generic", "reason": "image_quality"}

If food is present but confidence is too low to identify specific items, return:
{"detectedItems": [], "mode": "generic", "reason": "low_confidence"}

Return ONLY the JSON object with no markdown formatting, no code fences, and no additional text before or after.`;
  }

  try {
    console.log('[/analyze] Calling Anthropic API...');
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
    const raw = response.content[0]?.text ?? '';
    console.log('[/analyze] Raw response:', raw.slice(0, 200));
    const parsed = extractJSON(raw);
    console.log('[/analyze] items:', parsed.detectedItems?.length, 'reason:', parsed.reason ?? 'none');
    res.json(parsed);
  } catch (err) {
    console.error('[/analyze] Error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── /reanalyze ──────────────────────────────────────────────────────────────

app.post('/reanalyze', async (req, res) => {
  console.log('[/reanalyze] request received');
  const { imageBase64, feedback, previousItems, menuItems } = req.body;
  console.log(`[/reanalyze] imageBase64 length: ${imageBase64?.length ?? 'MISSING'}, feedback: "${feedback}", previousItems: ${previousItems?.length ?? 0}`);

  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
  if (!feedback)    return res.status(400).json({ error: 'feedback is required' });

  const previousList = Array.isArray(previousItems) && previousItems.length > 0
    ? previousItems.map(i => i.name).join(', ')
    : '(none identified)';

  let prompt;
  if (menuItems && menuItems.length > 0) {
    const menuList = menuItems
      .map(i => `- ${i.name}: ${i.calories} cal, ${i.protein}g protein, ${i.carbs}g carbs, ${i.fat}g fat`)
      .join('\n');
    prompt = `${FOOD_PREAMBLE}

The user has photographed their meal at a dining hall.

The following items are currently on the menu:
${menuList}

The previous analysis identified: ${previousList}.
The user says: '${feedback}'.

Re-analyze the image with this correction in mind and return an updated result.
Return ONLY valid JSON in this exact format:
{
  "detectedItems": [
    {
      "name": "item name exactly as listed above",
      "portionMultiplier": 1.0,
      "confidence": 0.9
    }
  ],
  "mode": "dining_hall"
}
Return ONLY the JSON object with no markdown formatting, no code fences, and no additional text before or after.`;
  } else {
    prompt = `${FOOD_PREAMBLE}

${SUPPLEMENT_GUIDANCE}

The previous analysis identified: ${previousList}.
The user says: '${feedback}'.

Re-analyze the image with this correction in mind and return an updated result.
Return ONLY valid JSON in this exact format:
{
  "detectedItems": [
    {
      "name": "food name",
      "calories": 300,
      "protein": 25,
      "carbs": 20,
      "fat": 8,
      "portionMultiplier": 1.0,
      "confidence": 0.85
    }
  ],
  "mode": "generic"
}
Return ONLY the JSON object with no markdown formatting, no code fences, and no additional text before or after.`;
  }

  try {
    console.log('[/reanalyze] Calling Anthropic API...');
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
    const raw = response.content[0]?.text ?? '';
    console.log('[/reanalyze] Raw response:', raw.slice(0, 200));
    const parsed = extractJSON(raw);
    console.log('[/reanalyze] items:', parsed.detectedItems?.length);
    res.json(parsed);
  } catch (err) {
    console.error('[/reanalyze] Error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── /lookup-nutrition ────────────────────────────────────────────────────────
// Single-item precise lookup via USDA FoodData Central

app.post('/lookup-nutrition', async (req, res) => {
  console.log('[/lookup-nutrition] request received');
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });
  try {
    const results = await searchUSDA(query);
    if (results.length > 0) return res.json(results[0]);
    throw new Error('No USDA results for query');
  } catch (err) {
    console.error('[/lookup-nutrition] Error:', err.message);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── /lookup ─────────────────────────────────────────────────────────────────
// "Add item manually" on EstimateScreen — tries OFF, falls back to Claude

app.post('/lookup', async (req, res) => {
  console.log('[/lookup] request received');
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  // Try Open Food Facts first (good for branded/packaged products)
  try {
    const results = await searchOpenFoodFacts(query);
    if (results.length > 0) {
      const r = results[0];
      console.log('[/lookup] OFF hit:', r.name);
      return res.json({ name: r.name, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat });
    }
  } catch (err) {
    console.error('[/lookup] OFF error:', err.message);
  }

  // Fall back to Claude
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Return nutrition facts for a standard serving of ${query} as JSON: {name, calories, protein, carbs, fat}. Return ONLY JSON, no markdown.`,
        },
      ],
    });
    const raw = response.content[0]?.text ?? '';
    console.log('[/lookup] Claude raw:', raw.slice(0, 200));
    const parsed = extractJSON(raw);
    res.json(parsed);
  } catch (err) {
    console.error('[/lookup] Error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── /search ─────────────────────────────────────────────────────────────────
// Food search for SearchScreen — parallel OFF + USDA, dedup, Claude fallback

app.get('/search', async (req, res) => {
  console.log('[/search] request received');
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'q is required' });
  console.log(`[/search] query: "${q}"`);

  const [offResults, usdaResults] = await Promise.all([
    searchOpenFoodFacts(q).catch(err => { console.error('[/search] OFF error:', err.message); return []; }),
    searchUSDA(q).catch(err => { console.error('[/search] USDA error:', err.message); return []; }),
  ]);

  console.log(`[/search] OFF: ${offResults.length}, USDA: ${usdaResults.length}`);

  // Deduplicate by lowercased name, OFF results first (more precise for branded products)
  const seen = new Set();
  const combined = [...offResults, ...usdaResults].filter(r => {
    const key = r.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);

  if (combined.length > 0) {
    console.log(`[/search] returning ${combined.length} deduped results`);
    return res.json(combined);
  }

  // Both sources empty — fall back to Claude
  console.log('[/search] no real-data results, falling back to Claude AI');
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `List the top 5 foods matching '${q}' with accurate nutrition per standard serving. Return ONLY a JSON array with no markdown: [{"name":"...","serving_size":"...","calories":0,"protein":0,"carbs":0,"fat":0}]`,
        },
      ],
    });
    const raw = response.content[0]?.text ?? '';
    console.log('[/search] Claude raw:', raw.slice(0, 300));
    const parsed = extractJSONArray(raw);
    res.json(parsed);
  } catch (err) {
    console.error('[/search] Claude error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── /health ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`DiningLens proxy running on :${PORT}`);
  console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'present' : 'MISSING'}`);
  console.log(`USDA_API_KEY: ${process.env.USDA_API_KEY || 'DEMO_KEY (default)'}`);
});
