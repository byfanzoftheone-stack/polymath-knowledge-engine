process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

test('plans endpoint lists tiers and checkout disabled by default', async () => {
  delete process.env.CHECKOUT_ENABLED;
  const res = await request(createApp()).get('/api/billing/plans');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.plans.length, 3);
  assert.equal(res.body.checkoutEnabled, false);
});

test('checkout is blocked (503) until owner enables it', async () => {
  delete process.env.CHECKOUT_ENABLED;
  const res = await request(createApp()).post('/api/billing/checkout').send({ plan: 'pro' });
  assert.equal(res.statusCode, 503);
});

test('relay requires API key when REQUIRE_API_KEY=true', async () => {
  process.env.REQUIRE_API_KEY = 'true';
  process.env.API_KEYS = 'k-free:free,k-pro:pro';
  const app = createApp();
  assert.equal((await request(app).post('/api/relay').send({})).statusCode, 401);
  assert.equal((await request(app).post('/api/relay').set('x-api-key', 'k-free').send({})).statusCode, 402);
  // pro passes the gate (then fails validation with 400, not 401/402)
  assert.equal((await request(app).post('/api/relay').set('x-api-key', 'k-pro').send({})).statusCode, 400);
  delete process.env.REQUIRE_API_KEY;
  delete process.env.API_KEYS;
});

test('waitlist rejects invalid email', async () => {
  const res = await request(createApp()).post('/api/billing/waitlist').send({ email: 'nope' });
  assert.equal(res.statusCode, 400);
});
