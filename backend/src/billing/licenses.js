const path = require('node:path');
const { createLicenseWebhook, JsonStore } = require('./licenseWebhook');
const { audit } = require('../governance/audit');

function dbFile() {
  return path.resolve(process.env.LICENSE_DB || './data/licenses.json');
}

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

// Built per call so env changes apply; the store is a small file read.
function getLicenses() {
  return createLicenseWebhook({
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    priceTiers: priceTiers(),
    store: new JsonStore(dbFile()),
    // Module audit records never contain plaintext keys or full emails.
    audit: (r) => audit(`license.${r.type}`, r)
  });
}

module.exports = { getLicenses, dbFile, priceTiers };
