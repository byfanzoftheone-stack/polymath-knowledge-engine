const { load } = require('./licenseWebhook');
const { audit } = require('../governance/audit');

// Price id -> tier, from env only, using existing tier names. Unset prices are omitted
// (never map "undefined"); unknown prices issue nothing.
function priceTiers() {
  const map = {};
  for (const tier of ['pro', 'team']) {
    const id = process.env[`STRIPE_PRICE_${tier.toUpperCase()}`];
    if (id) map[id] = tier;
  }
  return map;
}

// Cached by store config + secret so tests/env changes rebuild it, while production reuses one pool.
// FAIL CLOSED: storeFromEnv throws when nothing is configured; callers answer 503 / deny. A failed
// attempt is not cached, so fixing the env and retrying works without a restart.
let cache = null;
async function getLicenses() {
  const e = process.env;
  const sig = [e.LICENSE_DATABASE_URL, e.LICENSE_DATABASE_SSL, e.LICENSE_DB, e.LICENSE_DB_POOL_MAX, e.STRIPE_WEBHOOK_SECRET, JSON.stringify(priceTiers())].join('\u0000');
  if (cache && cache.sig === sig) return cache.promise;
  const promise = (async () => {
    const m = await load();
    const store = await m.storeFromEnv(process.env);
    const lw = m.createAsyncLicenseWebhook({
      secret: process.env.STRIPE_WEBHOOK_SECRET,
      priceTiers: priceTiers(),
      store,
      // Module audit records never contain plaintext keys or full emails.
      audit: (r) => audit(`license.${r.type}`, r)
    });
    return { lw, store, migrate: (file) => m.migrateFromLegacyJson(file, store) };
  })();
  cache = { sig, promise };
  promise.catch(() => { if (cache && cache.promise === promise) cache = null; });
  return promise;
}

async function getLicenseService() { return (await getLicenses()).lw; }

async function closeLicenses() {
  if (!cache) return;
  const p = cache.promise; cache = null;
  try {
    const { store } = await p;
    if (store.close) store.close(); else if (store.pool) await store.pool.end();
  } catch { /* nothing to close */ }
}

module.exports = { getLicenses, getLicenseService, closeLicenses, priceTiers };
