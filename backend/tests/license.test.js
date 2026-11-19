process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../src/app');

const SECRET = 'whsec_test_placeholder';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lic-'));
process.env.LICENSE_DB = path.join(dir, 'licenses.json');
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.STRIPE_PRICE_PRO = 'price_test_pro';
process.env.STRIPE_PRICE_TEAM = 'price_test_team';

function sign(body, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}
function paid(id, price, extra = {}) {
  return JSON.stringify({ id, type: 'checkout.session.completed', data: { object: {
    id: `cs_${id}`, payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1',
    customer_details: { email: 'buyer@example.com' }, metadata: { price_id: price }, ...extra } } });
}
const post = (app, body, sig) => request(app).post('/api/stripe/webhook').set('content-type', 'application/json').set('stripe-signature', sig).send(body);
const db = () => JSON.parse(fs.readFileSync(process.env.LICENSE_DB, 'utf8'));

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('webhook rejects bad and missing signatures', async () => {
  const app = createApp();
  const body = paid('evt_bad', 'price_test_pro');
  assert.equal((await post(app, body, sign(body, 'wrong'))).statusCode, 400);
  assert.equal((await post(app, body, 'garbage')).statusCode, 400);
  assert.equal((await request(app).post('/api/stripe/webhook').set('content-type', 'application/json').send(body)).statusCode, 400);
  assert.equal(fs.existsSync(process.env.LICENSE_DB), false);
});

test('paid checkout issues hashed key, queues plaintext, key unlocks relay; replay is idempotent', async () => {
  const app = createApp();
  const body = paid('evt_1', 'price_test_pro');
  const r1 = await post(app, body, sign(body));
  assert.equal(r1.statusCode, 200);
  assert.equal(r1.body.handled, true);
  const r2 = await post(app, body, sign(body));
  assert.equal(r2.body.duplicate, true);
  const d = db();
  assert.equal(Object.keys(d.licenses).length, 1);
  const [hash, out] = Object.entries(d.outbox)[0];
  assert.equal(d.licenses[hash].tier, 'pro');
  assert.match(out.key, /^FZ-PRO-/);
  assert.ok(!JSON.stringify(d.licenses).includes(out.key));

  process.env.REQUIRE_API_KEY = 'true';
  process.env.API_KEYS = 'k-env:pro';
  const gated = createApp();
  assert.equal((await request(gated).post('/api/relay').set('x-api-key', out.key).send({})).statusCode, 400); // passes gate
  assert.equal((await request(gated).post('/api/relay').set('x-api-key', 'k-env').send({})).statusCode, 400); // env key still works
  assert.equal((await request(gated).post('/api/relay').set('x-api-key', 'FZ-PRO-nope').send({})).statusCode, 401);
  delete process.env.REQUIRE_API_KEY;
  delete process.env.API_KEYS;
});

test('unknown price issues nothing', async () => {
  const app = createApp();
  const before = Object.keys(db().licenses).length;
  const body = paid('evt_2', 'price_unknown');
  const r = await post(app, body, sign(body));
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.handled, false);
  assert.equal(Object.keys(db().licenses).length, before);
});

test('owner delivery drops plaintext', () => {
  const { getLicenses } = require('../src/billing/licenses');
  const lw = getLicenses();
  const [p] = lw.pendingDeliveries();
  assert.ok(p.key);
  lw.markDelivered(p.hash, 'owner');
  assert.equal(lw.pendingDeliveries().length, 0);
  assert.equal(db().outbox[p.hash].key, undefined);
  assert.throws(() => lw.markDelivered(p.hash, ''));
});
