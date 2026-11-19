const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { getLicenses } = require('../billing/licenses');

const router = express.Router();
const limiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.WEBHOOK_RATE_LIMIT_PER_MIN || 300), standardHeaders: true, legacyHeaders: false });

// RAW body on THIS route only; mounted in app.js before express.json().
// Verifies signature, records and queues keys. Never sends email or calls Stripe.
router.post('/', limiter, express.raw({ type: '*/*', limit: '256kb' }), (req, res, next) => {
  try {
    const out = getLicenses().handle(req.body, req.get('stripe-signature'));
    return res.status(out.status).json(out.body);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
