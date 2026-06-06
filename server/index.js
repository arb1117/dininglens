require('dotenv').config();

const express = require('express');

// Handle both CJS and ESM-compat exports from @anthropic-ai/sdk
const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.Anthropic ?? AnthropicModule.default ?? AnthropicModule;

const app = express();
app.use(express.json({ limit: '20mb' }));

// Fail fast if the key is missing — better error than a silent 401 later
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set. Create a .env file or set the variable in your environment.');
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Robustly extract the first complete JSON object from model output,
// handling markdown code fences and any extra text before/after.
function extractJSON(text) {
  const stripped = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in response');
  return JSON.parse(stripped.slice(start, end + 1));
}

app.post('/analyze', async (req, res) => {
  console.log('[/analyze] request received');

  const { imageBase64, menuItems } = req.body;

  if (!imageBase64) {
    console.error('[/analyze] Missing imageBase64 in request body');
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  console.log(`[/analyze] imageBase64 length: ${imageBase64.length}, menuItems: ${menuItems?.length ?? 0}`);

  let prompt;

  if (menuItems && menuItems.length > 0) {
    const menuList = menuItems
      .map(i => `- ${i.name}: ${i.calories} cal, ${i.protein}g protein, ${i.carbs}g carbs, ${i.fat}g fat`)
      .join('\n');

    prompt = `You are a nutrition analysis assistant. The user has photographed their meal at a dining hall.

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
    prompt = `You are a nutrition analysis assistant. Identify all food items visible in this photo and estimate their calories and macros.
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
    console.log('[/analyze] Calling Anthropic API...');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const raw = response.content[0]?.text ?? '';
    console.log('[/analyze] Raw response:', raw.slice(0, 200));

    const parsed = extractJSON(raw);
    console.log('[/analyze] Parsed successfully, items:', parsed.detectedItems?.length);
    res.json(parsed);
  } catch (err) {
    console.error('[/analyze] Error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

app.post('/reanalyze', async (req, res) => {
  console.log('[/reanalyze] request received');
  const { imageBase64, feedback, previousItems, menuItems } = req.body;

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
    prompt = `You are a nutrition analysis assistant. The user has photographed their meal at a dining hall.

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
    prompt = `You are a nutrition analysis assistant.

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
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
    const raw = response.content[0]?.text ?? '';
    console.log('[/reanalyze] Raw response:', raw.slice(0, 200));
    const parsed = extractJSON(raw);
    res.json(parsed);
  } catch (err) {
    console.error('[/reanalyze] Error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

app.post('/lookup', async (req, res) => {
  console.log('[/lookup] request received');
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });
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
    console.log('[/lookup] Raw response:', raw.slice(0, 200));
    const parsed = extractJSON(raw);
    res.json(parsed);
  } catch (err) {
    console.error('[/lookup] Error:', err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`DiningLens proxy running on :${PORT}`);
  console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'present' : 'MISSING — server will fail'}`);
});
