require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dns = require('dns').promises;
const net = require('net');
const identityMiddleware          = require('./middleware/identity');
const entitlementService          = require('./services/entitlementService');
const requireActiveEntitlement    = require('./middleware/requireActiveEntitlement');
const requireCoachQuota           = require('./middleware/requireCoachQuota');

const aiProvider = require('./services/aiProvider');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS origin not allowed'));
  },
}));
// Per-route body parsers — image endpoints get 16mb for base64 payloads;
// all other JSON endpoints use 100kb to cap resource exhaustion from oversized bodies.
const smallJsonBody = express.json({ limit: '100kb' });
const largeJsonBody = express.json({ limit: '16mb' });

const IS_PROD = process.env.NODE_ENV === 'production';
const MAX_SCRAPE_BYTES = 512 * 1024; // 500KB

app.use((req, res, next) => {
  req.requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
});
app.use(identityMiddleware);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GLOBAL || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AI || 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please try again later.' },
});

const scrapeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_SCRAPE || 12),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many menu scraping requests. Please try again later.' },
});

// Protect the Google Places proxy — each request costs API credits.
const detectRestaurantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_DETECT_RESTAURANT || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many location requests. Please try again later.' },
});

// USDA and Open Food Facts lookups — stricter than global but less than AI calls.
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LOOKUP || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookup requests. Please try again later.' },
});

// Barcode lookups via Open Food Facts.
const barcodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_BARCODE || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many barcode requests. Please try again later.' },
});

app.use(globalLimiter);

function logDebug(...args) {
  if (!IS_PROD) console.log(...args);
}

function sendServerError(res, publicMessage = 'Something went wrong') {
  return res.status(500).json({ error: publicMessage });
}

const { z } = require('zod');

function validate(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.issues.map(i => i.message) });
    return null;
  }
  return result.data;
}

const analyzeSchema = z.object({
  imageBase64: z.string().min(100).max(15_000_000),
  // max(200) on array and max(200) on name prevent oversized payloads from menu data
  menuItems: z.array(z.object({
    name: z.string().max(200), calories: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(),
  })).max(200).optional(),
});

const reanalyzeSchema = analyzeSchema.extend({
  feedback: z.string().min(1).max(500),
  previousItems: z.array(z.any()).optional(),
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    todayLog: z.any().optional(),
    goals: z.any().optional(),
    water: z.any().optional(),
    exercise: z.any().optional(),
    streak: z.number().optional(),
    // Unknown keys are stripped by default — removed .passthrough() to prevent arbitrary data
    // from reaching Claude context.
  }).optional(),
  // Typed history items prevent arbitrary objects from being forwarded to the AI.
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(20).optional(),
});

// DEPRECATED: GoalsScreen now calculates TDEE locally via nutritionCalculator.ts.
// Schema updated to accept new app model values so it does not reject valid inputs.
const tdeeSchema = z.object({
  height_cm: z.number().min(50).max(300),
  weight_kg: z.number().min(20).max(500),
  age: z.number().min(10).max(120),
  sex: z.enum(['male', 'female', 'other']),
  goal: z.enum(['lose', 'maintain', 'build', 'lose_fat', 'gain_muscle', 'recomposition']),
  activityDescription: z.string().max(1000).optional(),
});

const searchSchema = z.object({ q: z.string().min(1).max(200) });

const lookupSchema = z.object({ query: z.string().min(1).max(200) });

const barcodeSchema = z.object({ code: z.string().min(1).max(50) });

const detectRestaurantSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const scrapeSchema = z.object({
  website: z.string().url().max(2048),
  restaurantName: z.string().min(1).max(200),
  placeId: z.string().max(200).optional(),
});

const exerciseSchema = z.object({
  name: z.string().min(1).max(200),
  duration: z.coerce.number().min(1).max(1440),
  type: z.enum(['cardio', 'strength', 'other']).optional(),
});

const interpretSchema = z.object({
  foodName: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  servingSize: z.string().max(100).optional(),
  caloriesPerServing: z.number().optional(),
});

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n))) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0 ||
    a >= 224
  );
}

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }
  return true;
}

async function assertPublicHttpsUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('Invalid URL'), { statusCode: 400 });
  }

  if (parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Only HTTPS URLs are supported'), { statusCode: 400 });
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw Object.assign(new Error('Private hostnames are not supported'), { statusCode: 400 });
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isPrivateIP(record.address))) {
    throw Object.assign(new Error('Private network URLs are not supported'), { statusCode: 400 });
  }

  return parsed.toString();
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

// ─── /analyze ────────────────────────────────────────────────────────────────

app.post('/analyze', largeJsonBody, aiLimiter, requireActiveEntitlement, async (req, res) => {
  console.log('[/analyze] request received');
  const body = validate(analyzeSchema, req.body, res);
  if (!body) return;
  const { imageBase64, menuItems } = body;
  logDebug(`[/analyze] imageBase64 length: ${imageBase64.length}, menuItems: ${menuItems?.length ?? 0}`);
  try {
    const result = await aiProvider.analyzeMealImage(imageBase64, menuItems);
    console.log('[/analyze] items:', result.detectedItems?.length, 'reason:', result.reason ?? 'none');
    res.json(result);
  } catch (err) {
    if (err.timeout) return res.status(504).json({ error: 'Analysis timed out', detectedItems: [], reason: 'timeout', validated: true });
    console.error('[/analyze] Error:', err.message ?? err, 'requestId=', req.requestId);
    sendServerError(res, 'Analysis failed');
  }
});

// ─── /reanalyze ──────────────────────────────────────────────────────────────

app.post('/reanalyze', largeJsonBody, aiLimiter, requireActiveEntitlement, async (req, res) => {
  console.log('[/reanalyze] request received');
  const body = validate(reanalyzeSchema, req.body, res);
  if (!body) return;
  const { imageBase64, feedback, previousItems, menuItems } = body;
  logDebug(`[/reanalyze] imageBase64 length: ${imageBase64.length}, previousItems: ${previousItems?.length ?? 0}`);
  try {
    const result = await aiProvider.reanalyzeMeal(imageBase64, feedback, previousItems, menuItems);
    console.log('[/reanalyze] items:', result.detectedItems?.length);
    res.json(result);
  } catch (err) {
    if (err.timeout) return res.status(504).json({ error: 'Analysis timed out', detectedItems: [], reason: 'timeout', validated: true });
    console.error('[/reanalyze] Error:', err.message ?? err, 'requestId=', req.requestId);
    sendServerError(res, 'Re-analysis failed');
  }
});

// ─── /lookup-nutrition ────────────────────────────────────────────────────────
// Single-item precise lookup via USDA FoodData Central

app.post('/lookup-nutrition', smallJsonBody, lookupLimiter, async (req, res) => {
  console.log('[/lookup-nutrition] request received');
  const body = validate(lookupSchema, req.body, res);
  if (!body) return;
  const { query } = body;
  try {
    const results = await searchUSDA(query);
    if (results.length > 0) return res.json(results[0]);
    throw new Error('No USDA results for query');
  } catch (err) {
    console.error('[/lookup-nutrition] Error:', err.message, 'requestId=', req.requestId);
    sendServerError(res, 'Nutrition lookup failed');
  }
});

// ─── Common food database ─────────────────────────────────────────────────────
// Quick local fallback for well-known foods that external DBs may not carry.

const COMMON_FOODS = [
  {
    name: 'Dubble Bubble Chewing Gum',
    aliases: ['dubble bubble', 'double bubble', 'bubble gum dubble', 'dubble bubble gum'],
    serving_size: '1 piece (5g)',
    calories: 25, protein: 0, carbs: 6, fat: 0,
  },
];

function lookupCommonFood(query) {
  const lower = query.toLowerCase().trim();
  return COMMON_FOODS.find(food =>
    food.name.toLowerCase().includes(lower) ||
    food.aliases.some(a => lower.includes(a) || a.includes(lower))
  ) ?? null;
}

// ─── /lookup ─────────────────────────────────────────────────────────────────
// "Add item manually" on EstimateScreen — tries OFF, falls back to Claude

app.post('/lookup', smallJsonBody, aiLimiter, requireActiveEntitlement, async (req, res) => {
  console.log('[/lookup] request received');
  const body = validate(lookupSchema, req.body, res);
  if (!body) return;
  const { query } = body;

  // Check local common foods first
  const common = lookupCommonFood(query);
  if (common) {
    console.log('[/lookup] common food hit:', common.name);
    return res.json({ name: common.name, calories: common.calories, protein: common.protein, carbs: common.carbs, fat: common.fat });
  }

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

  try {
    const parsed = await aiProvider.lookupFoodAI(query);
    logDebug('[/lookup] AI result:', parsed);
    res.json(parsed);
  } catch (err) {
    console.error('[/lookup] Error:', err.message ?? err, 'requestId=', req.requestId);
    sendServerError(res, 'Lookup failed');
  }
});

// ─── /search ─────────────────────────────────────────────────────────────────
// Food search for SearchScreen — parallel OFF + USDA, dedup, Claude fallback

app.get('/search', aiLimiter, requireActiveEntitlement, async (req, res) => {
  console.log('[/search] request received');
  const params = validate(searchSchema, req.query, res);
  if (!params) return;
  const { q } = params;
  console.log(`[/search] query: "${q}"`);

  // Check local common foods first
  const commonHit = lookupCommonFood(q);
  const commonResults = commonHit ? [{
    name: commonHit.name,
    serving_size: commonHit.serving_size,
    calories: commonHit.calories,
    protein: commonHit.protein,
    carbs: commonHit.carbs,
    fat: commonHit.fat,
    quantity: 1,
    unit: 'pieces',
    servingDescription: commonHit.serving_size,
    source: 'common',
  }] : [];

  const [offResults, usdaResults] = await Promise.all([
    searchOpenFoodFacts(q).catch(err => { console.error('[/search] OFF error:', err.message); return []; }),
    searchUSDA(q).catch(err => { console.error('[/search] USDA error:', err.message); return []; }),
  ]);

  console.log(`[/search] common: ${commonResults.length}, OFF: ${offResults.length}, USDA: ${usdaResults.length}`);

  // Deduplicate by lowercased name; common foods prepended so they always appear
  const seen = new Set();
  const combined = [...commonResults, ...offResults, ...usdaResults].filter(r => {
    const key = r.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);

  if (combined.length > 0) {
    console.log(`[/search] returning ${combined.length} deduped results`);
    return res.json(combined);
  }

  console.log('[/search] no real-data results, falling back to Claude AI');
  try {
    const parsed = await aiProvider.searchFoodAI(q);
    logDebug('[/search] AI result count:', parsed.length);
    res.json(parsed);
  } catch (err) {
    console.error('[/search] Claude error:', err.message ?? err, 'requestId=', req.requestId);
    sendServerError(res, 'Search failed');
  }
});

// ─── /health ─────────────────────────────────────────────────────────────────

// ─── /detect-restaurant ──────────────────────────────────────────────────────
// Proxies Google Places Nearby Search + Details so the API key stays server-side

app.post('/detect-restaurant', smallJsonBody, detectRestaurantLimiter, async (req, res) => {
  console.log('[/detect-restaurant] request received');
  const body = validate(detectRestaurantSchema, req.body, res);
  if (!body) return;
  const { lat, lon } = body;

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return res.status(503).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });

  try {
    // Step 1: Nearby Search — 100m radius, type=restaurant
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=100&type=restaurant&key=${key}`;
    const nearbyRes = await fetch(nearbyUrl, { signal: AbortSignal.timeout(8000) });
    const nearbyData = await nearbyRes.json();
    console.log('[/detect-restaurant] Places status:', nearbyData.status, 'results:', nearbyData.results?.length ?? 0);

    if (!nearbyData.results?.length) return res.json(null);

    const place = nearbyData.results[0];
    const placeId = place.place_id;
    const name = place.name;

    // Step 2: Place Details to get website (needed for mom-and-pop scrape)
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${key}`;
    const detailsRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(8000) });
    const detailsData = await detailsRes.json();
    const website = detailsData.result?.website ?? null;

    console.log(`[/detect-restaurant] Found: "${name}" placeId=${placeId} website=${website ?? 'none'}`);
    return res.json({ placeId, name, website });
  } catch (err) {
    console.error('[/detect-restaurant] Error:', err.message, 'requestId=', req.requestId);
    sendServerError(res, 'Restaurant detection failed');
  }
});

// ─── /scrape-menu ─────────────────────────────────────────────────────────────
// Fetches a restaurant website, extracts text, and uses Claude to parse the menu.
// Results are cached in memory by placeId.

const scrapeCache = new Map(); // placeId → { items, cachedAt }
const SCRAPE_CACHE_TTL_MS = Number(process.env.SCRAPE_CACHE_TTL_HOURS ?? 12) * 60 * 60 * 1000;
const SCRAPE_MENU_ENABLED = (process.env.SCRAPE_MENU_ENABLED ?? 'true') === 'true';

app.post('/scrape-menu', smallJsonBody, scrapeLimiter, requireActiveEntitlement, async (req, res) => {
  if (!SCRAPE_MENU_ENABLED) {
    return res.status(503).json({
      error: 'scrape_disabled',
      message: 'Menu scanning is temporarily unavailable.',
    });
  }
  console.log('[/scrape-menu] request received');
  const body = validate(scrapeSchema, req.body, res);
  if (!body) return;
  const { website, restaurantName, placeId } = body;

  // Check cache
  if (placeId) {
    const cached = scrapeCache.get(placeId);
    if (cached && Date.now() - cached.cachedAt < SCRAPE_CACHE_TTL_MS) {
      console.log(`[/scrape-menu] cache hit for placeId=${placeId}`);
      return res.json({ items: cached.items, source: 'cache' });
    }
  }

  try {
    const safeWebsite = await assertPublicHttpsUrl(website);

    // Fetch the website HTML (best-effort; JS-rendered sites will return minimal content)
    const pageRes = await fetch(safeWebsite, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiningLens/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    await assertPublicHttpsUrl(pageRes.url);
    const contentLength = Number(pageRes.headers.get('content-length') || 0);
    if (contentLength > MAX_SCRAPE_BYTES) {
      return res.status(413).json({ error: 'Menu page is too large' });
    }
    const html = await pageRes.text();
    if (html.length > MAX_SCRAPE_BYTES) {
      return res.status(413).json({ error: 'Menu page is too large' });
    }

    // Strip HTML tags and collapse whitespace for cleaner Claude input
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000); // cap to avoid token overrun

    console.log(`[/scrape-menu] fetched ${text.length} chars from ${safeWebsite}`);

    let items = [];
    try {
      items = await aiProvider.parseMenuText(text, restaurantName);
    } catch {
      items = [];
    }

    console.log(`[/scrape-menu] extracted ${items.length} items`);

    // Cache the result
    if (placeId) scrapeCache.set(placeId, { items, cachedAt: Date.now() });

    res.json({ items, source: 'scrape' });
  } catch (err) {
    console.error('[/scrape-menu] Error:', err.message, 'requestId=', req.requestId);
    const status = err.statusCode || 500;
    res.status(status).json({ error: status === 500 ? 'Menu scraping failed' : err.message });
  }
});

// ─── /barcode ────────────────────────────────────────────────────────────────
// Looks up a product by barcode via Open Food Facts

app.get('/barcode', barcodeLimiter, async (req, res) => {
  console.log('[/barcode] request received');
  const params = validate(barcodeSchema, req.query, res);
  if (!params) return;
  const { code } = params;

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
    console.error('[/barcode] Error:', err.message, 'requestId=', req.requestId);
    sendServerError(res, 'Barcode lookup failed');
  }
});

// ─── /estimate-exercise ──────────────────────────────────────────────────────

app.post('/estimate-exercise', smallJsonBody, aiLimiter, requireActiveEntitlement, async (req, res) => {
  const body = validate(exerciseSchema, req.body, res);
  if (!body) return;
  const { name, duration, type } = body;
  try {
    const result = await aiProvider.estimateExercise(name, duration, type);
    res.json({ caloriesBurned: Math.round(result.caloriesBurned ?? 0) });
  } catch (err) {
    // Fallback: rough estimate
    const kcal = type === 'cardio' ? duration * 7 : duration * 4;
    res.json({ caloriesBurned: kcal });
  }
});

// ─── /chat ───────────────────────────────────────────────────────────────────

app.post('/chat', smallJsonBody, aiLimiter, requireActiveEntitlement, requireCoachQuota, async (req, res) => {
  console.log('[/chat] request received');
  const body = validate(chatSchema, req.body, res);
  if (!body) return;
  const { message, context, history } = body;

  try {
    const { reply } = await aiProvider.chatCoach(message, context, history);
    console.log('[/chat] reply length:', reply.length);
    res.json({ reply });
  } catch (err) {
    console.error('[/chat] Error:', err.message ?? err, 'requestId=', req.requestId);
    sendServerError(res, 'Chat failed');
  }
});

// ─── /calculate-tdee ─────────────────────────────────────────────────────────
// Mifflin-St Jeor BMR → Claude picks activity multiplier from plain-English desc.

app.post('/calculate-tdee', smallJsonBody, aiLimiter, async (req, res) => {
  console.log('[/calculate-tdee] request received');
  const body = validate(tdeeSchema, req.body, res);
  if (!body) return;
  const { height_cm, weight_kg, age, sex, goal, activityDescription } = body;

  // Mifflin-St Jeor BMR (metric); 'other' uses average of male/female offsets (−78)
  const sexOffset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + sexOffset;
  console.log(`[/calculate-tdee] BMR=${Math.round(bmr)} goal=${goal}`);

  let multiplier = 1.55;
  let explanation = 'Based on your description, you appear moderately active.';

  if (activityDescription && activityDescription.trim().length > 5) {
    try {
      const parsed = await aiProvider.estimateTdeeMultiplier(activityDescription.trim());
      if (parsed.multiplier >= 1.2 && parsed.multiplier <= 1.9) multiplier = parsed.multiplier;
      if (parsed.explanation) explanation = parsed.explanation;
    } catch (err) {
      console.error('[/calculate-tdee] Claude error:', err.message);
    }
  }

  const tdee = Math.round(bmr * multiplier);

  // Goal-based calorie adjustment (new goal keys map to legacy behaviour)
  const calorieAdjust = {
    lose: -500, lose_fat: -500,
    maintain: 0,
    build: 300, gain_muscle: 300,
    recomposition: -200,
  };
  const calories = Math.max(Math.round(tdee + (calorieAdjust[goal] ?? 0)), 1200);

  // Macro splits (protein & carbs = 4 cal/g, fat = 9 cal/g)
  const splits = {
    lose:          { p: 0.40, c: 0.35, f: 0.25 },
    lose_fat:      { p: 0.40, c: 0.35, f: 0.25 },
    maintain:      { p: 0.30, c: 0.45, f: 0.25 },
    build:         { p: 0.30, c: 0.50, f: 0.20 },
    gain_muscle:   { p: 0.30, c: 0.50, f: 0.20 },
    recomposition: { p: 0.40, c: 0.35, f: 0.25 },
  };
  const split = splits[goal] ?? splits.maintain;
  const protein = Math.round((calories * split.p) / 4);
  const carbs   = Math.round((calories * split.c) / 4);
  const fat     = Math.round((calories * split.f) / 9);

  console.log(`[/calculate-tdee] TDEE=${tdee} cal=${calories} multiplier=${multiplier}`);
  res.json({ bmr: Math.round(bmr), tdee, multiplier, explanation, calories, protein, carbs, fat });
});

// ─── /interpret-quantity ─────────────────────────────────────────────────────

app.post('/interpret-quantity', smallJsonBody, aiLimiter, requireActiveEntitlement, async (req, res) => {
  const body = validate(interpretSchema, req.body, res);
  if (!body) return;
  const { foodName, description, servingSize, caloriesPerServing } = body;
  try {
    const result = await aiProvider.interpretQuantity(foodName, description, servingSize, caloriesPerServing);
    res.json(result);
  } catch (err) {
    console.error('[/interpret-quantity] Error:', err.message ?? err, 'requestId=', req.requestId);
    sendServerError(res, 'Quantity interpretation failed');
  }
});

// ─── /entitlements/me ────────────────────────────────────────────────────────

app.get('/entitlements/me', smallJsonBody, async (req, res) => {
  try {
    const rec  = entitlementService.getOrCreateEntitlement(req.actor.id);
    const snap = entitlementService.getUsageSnapshot(req.actor.id);
    const appOk   = entitlementService.canUseApp(req.actor.id);
    const coachOk = entitlementService.canUseCoach(req.actor.id);
    return res.json({
      status:                  rec.status,
      trialStartedAt:          rec.trialStartedAt,
      trialEndsAt:             rec.trialEndsAt,
      canUseApp:               appOk,
      canUseCoach:             coachOk,
      coachMessagesRemaining:  snap.coachMessagesRemaining,
      coachMessagesLimit:      snap.coachMessagesLimit,
      coachMessagesResetAt:    snap.coachMessagesResetAt,
      canUseScrape:            appOk,
    });
  } catch (err) {
    console.error('[/entitlements/me] Error:', err.message, 'requestId=', req.requestId);
    sendServerError(res, 'Could not load entitlement');
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  const id = Math.random().toString(36).slice(2, 8);
  console.error(`[error:${id}]`, err.message);
  res.status(err.status || 500).json({ error: 'An unexpected error occurred', errorId: id });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`DiningLens proxy running on :${PORT}`);
  console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'present' : 'MISSING'}`);
  console.log(`USDA_API_KEY: ${process.env.USDA_API_KEY ? 'present' : 'DEMO_KEY (default)'}`);
});
