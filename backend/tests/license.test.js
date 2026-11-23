process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { getLicenseService, closeLicenses } = require('../src/billing/licenses');

const SECRET = 'whsec_test_placeholder';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lic-'));
process.env.LICENSE_DB = path.join(dir, 'licenses.sqlite');
delete process.env.LICENSE_DATABASE_URL;
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
// Read-only peek at the SQLite file (the app holds its own connection; WAL allows concurrent readers).
const { DatabaseSync } = require('node:sqlite');
function db() {
  const h = new DatabaseSync(process.env.LICENSE_DB, { readOnly: true });
  try {
    return {
      licenses: Object.fromEntries(h.prepare('SELECT * FROM licenses').all().map((r) => [r.hash, r])),
      outbox: Object.fromEntries(h.prepare('SELECT * FROM license_outbox').all().map((r) => [r.hash, r])),
    };
  } finally { h.close(); }
}

test.after(async () => { await closeLicenses(); fs.rmSync(dir, { recursive: true, force: true }); });

test('webhook rejects bad and missing signatures', async () => {
  const app = createApp();
  const body = paid('evt_bad', 'price_test_pro');
  assert.equal((await post(app, body, sign(body, 'wrong'))).statusCode, 400);
  assert.equal((await post(app, body, 'garbage')).statusCode, 400);
  assert.equal((await request(app).post('/api/stripe/webhook').set('content-type', 'application/json').send(body)).statusCode, 400);
  assert.equal(Object.keys(db().licenses).length, 0); // nothing recorded
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

test('owner delivery drops plaintext', async () => {
  const lw = await getLicenseService();
  const [p] = await lw.pendingDeliveries();
  assert.ok(p.key);
  await lw.markDelivered(p.hash, 'owner');
  assert.equal((await lw.pendingDeliveries()).length, 0);
  assert.equal(db().outbox[p.hash].key, null);
  await assert.rejects(() => lw.markDelivered(p.hash, ''));
});

test('25 concurrent copies of one event issue exactly one key', async () => {
  const app = createApp();
  const before = Object.keys(db().licenses).length;
  const body = paid('evt_race', 'price_test_team');
  const sig = sign(body);
  const rs = await Promise.all(Array.from({ length: 25 }, () => post(app, body, sig)));
  assert.ok(rs.every((r) => r.statusCode === 200));
  assert.equal(rs.filter((r) => r.body.handled === true).length, 1);
  assert.equal(rs.filter((r) => r.body.duplicate === true).length, 24);
  assert.equal(Object.keys(db().licenses).length, before + 1);
});

test('unconfigured store fails closed: webhook 503, issued keys denied, env keys still work', async () => {
  const body = paid('evt_noconf', 'price_test_pro');
  // Mint a real key first with the store configured.
  const app0 = createApp();
  await post(app0, paid('evt_mint', 'price_test_pro'), sign(paid('evt_mint', 'price_test_pro')));
  const key = (await (await getLicenseService()).pendingDeliveries()).find((p) => p.tier === 'pro').key;

  const saved = process.env.LICENSE_DB;
  delete process.env.LICENSE_DB;
  delete process.env.LICENSE_DATABASE_URL;
  process.env.REQUIRE_API_KEY = 'true';
  process.env.API_KEYS = 'k-env:pro';
  try {
    const app = createApp();
    const r = await post(app, body, sign(body));
    assert.equal(r.statusCode, 503);
    assert.equal((await request(app).post('/api/relay').set('x-api-key', key).send({})).statusCode, 401); // denied
    assert.equal((await request(app).post('/api/relay').set('x-api-key', 'k-env').send({})).statusCode, 400); // env key passes
  } finally {
    process.env.LICENSE_DB = saved;
    delete process.env.REQUIRE_API_KEY;
    delete process.env.API_KEYS;
  }
  // Recovers once configured again, no restart needed.
  assert.equal((await post(createApp(), body, sign(body))).statusCode, 200);
});

test('migrate-json imports a legacy JSON DB; keys stay valid; events stay claimed', async () => {
  const { hashKey } = await import('../src/billing/vendor/index.mjs');
  const legacyKey = 'FZ-PRO-legacykey';
  const file = path.join(dir, 'legacy.json');
  fs.writeFileSync(file, JSON.stringify({
    events: { evt_legacy: { type: 'checkout.session.completed', at: '2026-01-01T00:00:00.000Z' } },
    licenses: { [hashKey(legacyKey)]: { tier: 'pro', status: 'active', created: '2026-01-01T00:00:00.000Z', customer: 'cus_L', subscription: 'sub_L' } },
    outbox: {},
  }));
  const { getLicenses } = require('../src/billing/licenses');
  const c = await (await getLicenses()).migrate(file);
  assert.deepEqual(c, { licenses: 1, outbox: 0, events: 1 });
  assert.deepEqual(await (await getLicenseService()).validate(legacyKey), { valid: true, tier: 'pro' });
  const body = paid('evt_legacy', 'price_test_pro');
  assert.equal((await post(createApp(), body, sign(body))).body.duplicate, true);
});
