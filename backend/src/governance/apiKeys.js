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

// Attaches req.auth = { tier }. Reads `x-api-key` or `Authorization: Bearer`.
function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const presented = req.get('x-api-key') || (header.startsWith('Bearer ') ? header.slice(7) : '');
  const match = lookup(presented, parseKeys());
  req.auth = { tier: match ? match.tier : 'anonymous' };
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
