const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { plans } = require('../billing/plans');
const { audit } = require('../governance/audit');
const { query } = require('../db');

const router = express.Router();

const strictLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.get('/plans', (_req, res) => {
  res.json({ ok: true, plans: plans(), checkoutEnabled: process.env.CHECKOUT_ENABLED === 'true' });
});

// Checkout stub. Human approval gate: nothing talks to Stripe unless the owner sets
// CHECKOUT_ENABLED=true AND STRIPE_SECRET_KEY AND STRIPE_PRICE_<PLAN>. Otherwise returns a harmless 503.
router.post('/checkout', strictLimiter, async (req, res, next) => {
  const planId = String((req.body || {}).plan || '').toLowerCase();
  const plan = plans().find((p) => p.id === planId && p.priceUsdMonthly > 0);
  if (!plan) return res.status(400).json({ ok: false, error: 'Unknown or non-paid plan' });

  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env[`STRIPE_PRICE_${planId.toUpperCase()}`];
  if (process.env.CHECKOUT_ENABLED !== 'true' || !secret || !priceId) {
    audit('billing.checkout.blocked', { plan: planId, reason: 'not_enabled_or_unconfigured' });
    return res.status(503).json({ ok: false, error: 'Checkout is not enabled yet. Join the waitlist at POST /api/billing/waitlist.' });
  }

  try {
    const base = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      // Server-side price id lets the webhook map to a tier (client data never picks the tier).
      'metadata[price_id]': priceId,
      success_url: `${base}/?checkout=success`,
      cancel_url: `${base}/?checkout=cancel`
    });
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await r.json();
    if (!r.ok) {
      audit('billing.checkout.error', { plan: planId, status: r.status });
      return res.status(502).json({ ok: false, error: 'Payment provider error' });
    }
    audit('billing.checkout.created', { plan: planId, sessionId: data.id });
    return res.json({ ok: true, url: data.url });
  } catch (error) {
    return next(error);
  }
});

router.post('/waitlist', strictLimiter, async (req, res, next) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!/^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$/.test(email) || email.length > 320) {
    return res.status(400).json({ ok: false, error: 'Valid email required' });
  }
  const plan = ['pro', 'team'].includes((req.body || {}).plan) ? req.body.plan : 'pro';
  try {
    await query('INSERT INTO waitlist (email, plan) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING', [email, plan]);
    audit('billing.waitlist.joined', { plan });
    return res.status(201).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
