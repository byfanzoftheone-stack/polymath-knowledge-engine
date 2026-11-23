const crypto = require('node:crypto');

const TIER_RANK = { free: 0, pro: 1, team: 2 };

// API_KEYS env format: "<key>:<tier>,<key2>:<tier>" (keys live only in env, never in code).
function parseKeys(raw = process.env.API_KEYS || '') {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.lastIndexOf(':');
      const key = idx > 0 ? entry.slice(0, idx) : entry;
      const tier = idx > 0 ? entry.slice(idx + 1) : 'pro';
      return { digest: crypto.createHash('sha256').update(key).digest(), tier: tier in TIER_RANK ? tier : 'free' };
    });
}

function lookup(presented, keys) {
  if (!presented) return null;
  const digest = crypto.createHash('sha256').update(String(presented)).digest();
  let found = null;
  for (const k of keys) {
    if (crypto.timingSafeEqual(k.digest, digest)) found = k;
  }
  return found;
}

// Validate a webhook-issued key against the async license store. FAIL CLOSED: any error
// (store not configured, DB down) means no tier, never access.
async function licenseTier(presented) {
  try {
    const { getLicenseService } = require('../billing/licenses');
    const r = await (await getLicenseService()).validate(String(presented));
    return r.valid && r.tier in TIER_RANK ? r.tier : null;
  } catch {
    return null;
  }
}

// Attaches req.auth = { tier }. Reads `x-api-key` or `Authorization: Bearer`. Async (store lookup).
async function authenticate(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const presented = req.get('x-api-key') || (header.startsWith('Bearer ') ? header.slice(7) : '');
    const match = lookup(presented, parseKeys());
    let tier = match ? match.tier : 'anonymous';
    // Env keys win and never touch the store. Then keys issued by the Stripe webhook (hash-only store).
    if (!match && presented && String(presented).startsWith('FZ-')) tier = (await licenseTier(presented)) || tier;
    req.auth = { tier };
  } catch {
    req.auth = { tier: 'anonymous' };
  }
  next();
}

// Gate a route to a minimum paid tier. Enforced only when REQUIRE_API_KEY=true.
function requireTier(minTier) {
  return (req, res, next) => {
    if (process.env.REQUIRE_API_KEY !== 'true') return next();
    const rank = TIER_RANK[req.auth && req.auth.tier];
    if (rank === undefined) {
      return res.status(401).json({ ok: false, error: 'API key required. See /api/billing/plans.' });
    }
    if (rank < TIER_RANK[minTier]) {
      return res.status(402).json({ ok: false, error: `Requires ${minTier} tier or above.`, upgrade: '/api/billing/plans' });
    }
    return next();
  };
}

module.exports = { authenticate, requireTier, parseKeys, TIER_RANK };
