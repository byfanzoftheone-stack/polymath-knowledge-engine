const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { getLicenseService } = require('../billing/licenses');

const router = express.Router();
const limiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.WEBHOOK_RATE_LIMIT_PER_MIN || 300), standardHeaders: true, legacyHeaders: false });

// RAW body on THIS route only; mounted in app.js before express.json().
// Verifies signature, records and queues keys. Never sends email or calls Stripe.
router.post('/', limiter, express.raw({ type: '*/*', limit: '256kb' }), async (req, res, next) => {
  let lw;
  try {
    lw = await getLicenseService();
  } catch (error) {
    // Fail closed: no license store configured/reachable. 503 makes Stripe retry later; nothing is recorded.
    console.error('license store unavailable:', error.message);
    return res.status(503).json({ error: 'license_store_unavailable' });
  }
  try {
    const out = await lw.handle(req.body, req.get('stripe-signature'));
    return res.status(out.status).json(out.body);
  } catch (error) {
    // A failed transaction rolled back, so Stripe's retry can succeed.
    return next(error);
  }
});

module.exports = router;
