process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.NODE_ENV = 'test';

jest.mock('./services/aiProvider');

const request = require('supertest');
const aiProvider = require('./services/aiProvider');
const app = require('./index');

const INSTALL = { 'X-DiningLens-Install-Id': 'jest-install-routes-01' };
const IMAGE = 'A'.repeat(200);

function offResponse(status, body) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /read-label', () => {
  it('rejects a missing image', async () => {
    const res = await request(app).post('/read-label').set(INSTALL).send({});
    expect(res.status).toBe(400);
  });

  it('returns the label as a single generic item', async () => {
    aiProvider.readNutritionLabel.mockResolvedValue({
      found: true, name: 'Grilled Chicken', servingSize: '1 breast (140g)',
      calories: 230, protein: 43, carbs: 0, fat: 5,
    });
    const res = await request(app).post('/read-label').set(INSTALL).send({ imageBase64: IMAGE });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('generic');
    expect(res.body.detectedItems).toEqual([expect.objectContaining({
      name: 'Grilled Chicken', calories: 230, protein: 43, carbs: 0, fat: 5,
      confidence: 1, servingDescription: '1 breast (140g)',
    })]);
  });

  it('returns reason no_label when nothing is legible', async () => {
    aiProvider.readNutritionLabel.mockResolvedValue({ found: false, reason: 'no_label' });
    const res = await request(app).post('/read-label').set(INSTALL).send({ imageBase64: IMAGE });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ detectedItems: [], mode: 'generic', reason: 'no_label' });
  });

  it('maps an AI timeout to 504', async () => {
    aiProvider.readNutritionLabel.mockRejectedValue(Object.assign(new Error('AI timeout'), { timeout: true }));
    const res = await request(app).post('/read-label').set(INSTALL).send({ imageBase64: IMAGE });
    expect(res.status).toBe(504);
    expect(res.body.reason).toBe('timeout');
  });
});

describe('GET /barcode', () => {
  it('returns 404 when Open Food Facts has no product', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => offResponse(200, { status: 0 }));
    const res = await request(app).get('/barcode?code=0000000000000').set(INSTALL);
    expect(res.status).toBe(404);
  });

  it('returns 422 with the product name when nutrition is missing', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      offResponse(200, { status: 1, product: { product_name: 'Mystery Bar', nutriments: {} } }));
    const res = await request(app).get('/barcode?code=1111111111111').set(INSTALL);
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'no_nutrition', name: 'Mystery Bar' });
  });

  it('converts kJ-only energy to kcal', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      offResponse(200, {
        status: 1,
        product: { product_name: 'Oat Bar', nutriments: { energy_100g: 1000, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 8 } },
      }));
    const res = await request(app).get('/barcode?code=2222222222222').set(INSTALL);
    expect(res.status).toBe(200);
    expect(res.body.calories).toBe(239);
    expect(res.body.protein).toBe(10);
  });

  it('returns 502 when Open Food Facts is down', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => offResponse(503, {}));
    const res = await request(app).get('/barcode?code=3333333333333').set(INSTALL);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('upstream_unavailable');
  });

  it('returns 504 when Open Food Facts times out', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.reject(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })));
    const res = await request(app).get('/barcode?code=4444444444444').set(INSTALL);
    expect(res.status).toBe(504);
  });
});

describe('BETA_OPEN_ACCESS', () => {
  function loadEntitlements(env) {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    let svc;
    jest.isolateModules(() => { svc = require('./services/entitlementService'); });
    process.env = saved;
    return svc;
  }

  it('expires trials when off', () => {
    const svc = loadEntitlements({ BETA_OPEN_ACCESS: 'false', TRIAL_DAYS: '0' });
    const rec = svc.getOrCreateEntitlement('beta-off');
    expect(svc.getComputedStatus(rec)).toBe('expired');
    expect(svc.canUseApp('beta-off')).toBe(false);
  });

  it('keeps everyone in beta when on, with daily coach limits intact', () => {
    const svc = loadEntitlements({ BETA_OPEN_ACCESS: 'true', TRIAL_DAYS: '0', TRIAL_COACH_DAILY_LIMIT: '1' });
    const rec = svc.getOrCreateEntitlement('beta-on');
    expect(svc.getComputedStatus(rec)).toBe('beta');
    expect(svc.canUseApp('beta-on')).toBe(true);
    expect(svc.canUseCoach('beta-on')).toBe(true);
    svc.incrementCoachUsage('beta-on');
    expect(svc.canUseCoach('beta-on')).toBe(false);
  });
});
