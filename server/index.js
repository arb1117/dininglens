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
  const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&fields=product_name,brands,serving_size,serving_quantity,nutriments,lang&page_size=10&lang=en&countries_tags=en:united-states`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();

  return (data.products || [])
    .map(p => {
      if (!p.product_name) return null;
      // Skip products whose names contain no ASCII printable characters (foreign-language)
      if (!/[\x20-\x7E]/.test(p.product_name)) return null;

      const n = p.nutriments || {};
      const sq = p.serving_quantity ? parseFloat(p.serving_quantity) : null;

      const calcMacro = (servingKey, per100Key) => {
        const s = n[servingKey];
        if (s != null) return s;
        if (n[per100Key] != null && sq) return n[per100Key] * sq / 100;
        return null;
      };

      const kcalServing = calcMacro('energy-kcal_serving', 'energy-kcal_100g');
      if (kcalServing === null) return null;

      const brand = (p.brands || '').split(',')[0].trim();
      const name = brand && !p.product_name.toLowerCase().startsWith(brand.toLowerCase())
        ? `${brand} ${p.product_name}`.trim()
        : p.product_name;

      return {
        name,
        serving_size: p.serving_size || (sq ? `${sq}g` : 'per 100g'),
        calories: Math.round(kcalServing),
        protein: Math.round((calcMacro('proteins_serving', 'proteins_100g') ?? 0) * 10) / 10,
        carbs: Math.round((calcMacro('carbohydrates_serving', 'carbohydrates_100g') ?? 0) * 10) / 10,
        fat: Math.round((calcMacro('fat_serving', 'fat_100g') ?? 0) * 10) / 10,
        source: 'openfoodfacts',
      };
    })
    .filter(Boolean);
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
- Do not identify people, hands, or body parts as food items

For each food item:
- Estimate the actual visible quantity using visual reference cues in the frame
  (plate diameter ≈ 25cm, palm-size protein ≈ 85g, tennis ball ≈ 0.5 cup cooked grain)
- Return estimatedQuantityGrams: your best numeric estimate of grams (or ml for liquids)
- Calculate calories and macros FROM that weight, not from a generic serving
- Set portionMultiplier = estimatedQuantityGrams / 100 (so the portion buttons scale from your estimate)

Common per-100g references:
  Cooked chicken breast: 165 cal, 31g P, 0g C, 3.6g F
  Cooked white rice: 130 cal, 2.7g P, 28g C, 0.3g F
  Cooked pasta: 158 cal, 5.8g P, 31g C, 0.9g F
  Whole milk: 61 cal, 3.2g P, 4.8g C, 3.3g F
  Unsweetened almond milk: 15 cal, 0.4g P, 0.4g C, 1.3g F
  Banana: 89 cal, 1.1g P, 23g C, 0.3g F
  Peanut butter: 588 cal, 25g P, 20g C, 50g F
  Greek yogurt (plain): 59 cal, 10g P, 3.6g C, 0.4g F
  Oats (dry): 389 cal, 17g P, 66g C, 7g F
  Broccoli: 34 cal, 2.8g P, 7g C, 0.4g F
  Egg (whole): 155 cal, 13g P, 1.1g C, 11g F
  Cheddar cheese: 403 cal, 25g P, 1.3g C, 33g F
  Olive oil: 884 cal, 0g P, 0g C, 100g F
  Whey protein powder: 400 cal, 80g P, 8g C, 8g F (per 100g dry)`;

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

Identify which of these menu items are visible in the photo and estimate the visible quantity.
Return ONLY valid JSON in this exact format:
{
  "detectedItems": [
    {
      "name": "item name exactly as listed above",
      "estimatedQuantity": "180g",
      "estimatedQuantityGrams": 180,
      "portionMultiplier": 1.8,
      "confidence": 0.9
    }
  ],
  "mode": "dining_hall"
}
Set portionMultiplier = estimatedQuantityGrams / 100. Only include items you can actually see.
Return ONLY the JSON object with no markdown formatting, no code fences, and no additional text before or after.`;
  } else {
    prompt = `${FOOD_PREAMBLE}

${SUPPLEMENT_GUIDANCE}

Identify all food items visible in this photo and estimate their calories and macros based on actual visible weight.
Return ONLY valid JSON in this exact format:
{
  "detectedItems": [
    {
      "name": "food name",
      "estimatedQuantity": "150g",
      "estimatedQuantityGrams": 150,
      "calories": 300,
      "protein": 25,
      "carbs": 20,
      "fat": 8,
      "portionMultiplier": 1.5,
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
      "estimatedQuantity": "180g",
      "estimatedQuantityGrams": 180,
      "portionMultiplier": 1.8,
      "confidence": 0.9
    }
  ],
  "mode": "dining_hall"
}
Set portionMultiplier = estimatedQuantityGrams / 100.
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
      "estimatedQuantity": "150g",
      "estimatedQuantityGrams": 150,
      "calories": 300,
      "protein": 25,
      "carbs": 20,
      "fat": 8,
      "portionMultiplier": 1.5,
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

// ─── /detect-restaurant ──────────────────────────────────────────────────────
// Proxies Google Places Nearby Search + Details so the API key stays server-side

app.post('/detect-restaurant', async (req, res) => {
  console.log('[/detect-restaurant] request received');
  const { lat, lon } = req.body;
  if (lat == null || lon == null) return res.status(400).json({ error: 'lat and lon required' });

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return res.status(503).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });

  try {
    // Step 1: Nearby Search — 100m radius, type=restaurant
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=100&type=restaurant&key=${key}`;
    const nearbyRes = await fetch(nearbyUrl);
    const nearbyData = await nearbyRes.json();
    console.log('[/detect-restaurant] Places status:', nearbyData.status, 'results:', nearbyData.results?.length ?? 0);

    if (!nearbyData.results?.length) return res.json(null);

    const place = nearbyData.results[0];
    const placeId = place.place_id;
    const name = place.name;

    // Step 2: Place Details to get website (needed for mom-and-pop scrape)
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${key}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();
    const website = detailsData.result?.website ?? null;

    console.log(`[/detect-restaurant] Found: "${name}" placeId=${placeId} website=${website ?? 'none'}`);
    return res.json({ placeId, name, website });
  } catch (err) {
    console.error('[/detect-restaurant] Error:', err.message);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── /scrape-menu ─────────────────────────────────────────────────────────────
// Fetches a restaurant website, extracts text, and uses Claude to parse the menu.
// Results are cached in memory by placeId.

const scrapeCache = new Map(); // placeId → { items, cachedAt }
const SCRAPE_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

app.post('/scrape-menu', async (req, res) => {
  console.log('[/scrape-menu] request received');
  const { website, restaurantName, placeId } = req.body;
  if (!website || !restaurantName) return res.status(400).json({ error: 'website and restaurantName required' });

  // Check cache
  if (placeId) {
    const cached = scrapeCache.get(placeId);
    if (cached && Date.now() - cached.cachedAt < SCRAPE_CACHE_TTL_MS) {
      console.log(`[/scrape-menu] cache hit for placeId=${placeId}`);
      return res.json({ items: cached.items, source: 'cache' });
    }
  }

  try {
    // Fetch the website HTML (best-effort; JS-rendered sites will return minimal content)
    const pageRes = await fetch(website, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiningLens/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await pageRes.text();

    // Strip HTML tags and collapse whitespace for cleaner Claude input
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000); // cap to avoid token overrun

    console.log(`[/scrape-menu] fetched ${text.length} chars from ${website}`);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `This is the menu/website text for ${restaurantName}. Extract all food items with estimated calories and macros. Return ONLY a JSON array with no markdown: [{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"serving_size":"..."}]. Estimate macros based on typical restaurant preparation if exact values are not listed. If no menu items can be found, return [].`,
        },
        {
          role: 'assistant',
          content: `Here is the website content:\n${text}\n\nExtracted menu items:`,
        },
      ],
    });

    const raw = response.content[0]?.text ?? '';
    console.log('[/scrape-menu] Claude raw:', raw.slice(0, 300));
    let items = [];
    try {
      items = extractJSONArray(raw);
    } catch {
      items = [];
    }

    console.log(`[/scrape-menu] extracted ${items.length} items`);

    // Cache the result
    if (placeId) scrapeCache.set(placeId, { items, cachedAt: Date.now() });

    res.json({ items, source: 'scrape' });
  } catch (err) {
    console.error('[/scrape-menu] Error:', err.message);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── /barcode ────────────────────────────────────────────────────────────────
// Looks up a product by barcode via Open Food Facts

app.get('/barcode', async (req, res) => {
  console.log('[/barcode] request received');
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();

    if (data.status !== 1 || !data.product) {
      console.log(`[/barcode] not found: ${code}`);
      return res.status(404).json({ error: 'Product not found' });
    }

    const p = data.product;
    const n = p.nutriments || {};

    const cal100g = n['energy-kcal_100g'] || 0;
    const pro100g = n['proteins_100g'] || 0;
    const carb100g = n['carbohydrates_100g'] || 0;
    const fat100g = n['fat_100g'] || 0;

    const servingGrams = parseFloat(p.serving_quantity) || 100;
    const brand = p.brands ? p.brands.split(',')[0].trim() + ' ' : '';
    const name = `${brand}${p.product_name || 'Unknown Product'}`.trim();

    const result = {
      name,
      serving_size: p.serving_size || `${servingGrams}g`,
      calories: Math.round((cal100g * servingGrams) / 100),
      protein: Math.round((pro100g * servingGrams) / 100 * 10) / 10,
      carbs: Math.round((carb100g * servingGrams) / 100 * 10) / 10,
      fat: Math.round((fat100g * servingGrams) / 100 * 10) / 10,
      estimatedQuantityGrams: servingGrams,
      source: 'barcode',
    };
    console.log(`[/barcode] found: ${name}, serving=${servingGrams}g, cal=${result.calories}`);
    return res.json(result);
  } catch (err) {
    console.error('[/barcode] Error:', err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ─── /estimate-exercise ──────────────────────────────────────────────────────

app.post('/estimate-exercise', async (req, res) => {
  const { name, duration, type } = req.body;
  if (!name || !duration) return res.status(400).json({ error: 'name and duration required' });
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: `Estimate calories burned for: ${name}, ${duration} minutes, type: ${type || 'cardio'}. Return ONLY JSON: {"caloriesBurned": <number>}`,
      }],
    });
    const parsed = extractJSON(response.content[0]?.text ?? '{}');
    res.json({ caloriesBurned: Math.round(parsed.caloriesBurned ?? 0) });
  } catch (err) {
    // Fallback: rough estimate
    const kcal = type === 'cardio' ? duration * 7 : duration * 4;
    res.json({ caloriesBurned: kcal });
  }
});

// ─── /chat ───────────────────────────────────────────────────────────────────

const COACH_SYSTEM = `You are a friendly, encouraging nutrition and fitness coach integrated into DiningLens, a macro tracking app. You have access to the user's current food log and goals.

Be conversational and supportive. Keep responses concise (2-4 sentences max unless the user asks for detail). You can:
- Analyze what they've eaten today and give feedback
- Suggest specific foods or meals to hit their remaining macros
- Answer nutrition questions
- Give workout suggestions
- Help plan meals

When suggesting foods, format them as: **Food Name** - X cal, Xg protein
The user can tap a suggested food to add it directly to their log.

Never be preachy or guilt-trip about food choices.`;

app.post('/chat', async (req, res) => {
  console.log('[/chat] request received');
  const { message, context, history } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const contextBlock = context ? `\n\nUser context:\n- Today: ${context.todayLog?.meals ?? 0} meals logged, ${Math.round(context.todayLog?.totals?.cal ?? 0)} cal eaten\n- Goals: ${context.goals?.calories ?? '?'} cal, ${context.goals?.protein ?? '?'}g protein\n- Streak: ${context.streak ?? 0} days` : '';

  const messages = [
    ...(Array.isArray(history) ? history.slice(-8).map(h => ({ role: h.role, content: h.content })) : []),
    { role: 'user', content: message + contextBlock },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: COACH_SYSTEM,
      messages,
    });
    const reply = response.content[0]?.text ?? "I'm not sure how to answer that.";
    console.log('[/chat] reply length:', reply.length);
    res.json({ reply });
  } catch (err) {
    console.error('[/chat] Error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// ─── /calculate-tdee ─────────────────────────────────────────────────────────
// Mifflin-St Jeor BMR → Claude picks activity multiplier from plain-English desc.

app.post('/calculate-tdee', async (req, res) => {
  console.log('[/calculate-tdee] request received');
  const { height_cm, weight_kg, age, sex, goal, activityDescription } = req.body;
  if (!height_cm || !weight_kg || !age || !sex || !goal) {
    return res.status(400).json({ error: 'height_cm, weight_kg, age, sex, goal required' });
  }

  // Mifflin-St Jeor BMR (metric)
  const bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + (sex === 'male' ? 5 : -161);
  console.log(`[/calculate-tdee] BMR=${Math.round(bmr)} goal=${goal}`);

  let multiplier = 1.55;
  let explanation = 'Based on your description, you appear moderately active.';

  if (activityDescription && activityDescription.trim().length > 5) {
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 128,
        messages: [{
          role: 'user',
          content: `Based on this lifestyle description, estimate an activity multiplier for TDEE calculation.\nSedentary = 1.2, Light = 1.375, Moderate = 1.55, Active = 1.725, Very Active = 1.9\nDescription: "${activityDescription.trim()}"\nReturn JSON only: { "multiplier": <number>, "explanation": "<one sentence, plain English>" }`,
        }],
      });
      const parsed = extractJSON(response.content[0]?.text ?? '{}');
      if (parsed.multiplier >= 1.2 && parsed.multiplier <= 1.9) multiplier = parsed.multiplier;
      if (parsed.explanation) explanation = parsed.explanation;
    } catch (err) {
      console.error('[/calculate-tdee] Claude error:', err.message);
    }
  }

  const tdee = Math.round(bmr * multiplier);

  // Goal-based calorie adjustment
  const calorieAdjust = { lose: -500, maintain: 0, build: 300 };
  const calories = Math.max(Math.round(tdee + (calorieAdjust[goal] ?? 0)), 1200);

  // Macro splits (protein & carbs = 4 cal/g, fat = 9 cal/g)
  const splits = {
    lose:     { p: 0.40, c: 0.35, f: 0.25 },
    maintain: { p: 0.30, c: 0.45, f: 0.25 },
    build:    { p: 0.30, c: 0.50, f: 0.20 },
  };
  const split = splits[goal] ?? splits.maintain;
  const protein = Math.round((calories * split.p) / 4);
  const carbs   = Math.round((calories * split.c) / 4);
  const fat     = Math.round((calories * split.f) / 9);

  console.log(`[/calculate-tdee] TDEE=${tdee} cal=${calories} multiplier=${multiplier}`);
  res.json({ bmr: Math.round(bmr), tdee, multiplier, explanation, calories, protein, carbs, fat });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`DiningLens proxy running on :${PORT}`);
  console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'present' : 'MISSING'}`);
  console.log(`USDA_API_KEY: ${process.env.USDA_API_KEY || 'DEMO_KEY (default)'}`);
});
