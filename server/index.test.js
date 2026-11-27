process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('./index');

const INSTALL = { 'X-DiningLens-Install-Id': 'jest-install-0001' };

describe('server', () => {
  it('GET /health is ok and not rate limited', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-policy']).toBeUndefined();
  });

  it('POST /analyze rejects an invalid body', async () => {
    const res = await request(app).post('/analyze').set(INSTALL).send({});
    expect(res.status).toBe(400);
  });

  it('POST /analyze rejects images over 5MB with 413', async () => {
    const imageBase64 = 'A'.repeat(7 * 1024 * 1024);
    const res = await request(app).post('/analyze').set(INSTALL).send({ imageBase64 });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('image_too_large');
  });
});
