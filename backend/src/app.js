const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const path = require('node:path');
const fs = require('node:fs');

const healthRouter = require('./routes/health');
const lessonsRouter = require('./routes/lessons');
const sessionsRouter = require('./routes/sessions');
const relayRouter = require('./routes/relay');
const billingRouter = require('./routes/billing');
const { authenticate, requireTier } = require('./governance/apiKeys');
const { auditMiddleware } = require('./governance/audit');

function createApp() {
  const app = express();

  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
  app.use(express.json({ limit: '50kb' }));
  app.use(authenticate);
  app.use(auditMiddleware);

  // Global API rate limit (per IP). Tune with API_RATE_LIMIT_PER_MIN.
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.API_RATE_LIMIT_PER_MIN || 120),
    standardHeaders: true,
    legacyHeaders: false
  }));

  app.use('/health', healthRouter);
  app.use('/api/lessons', lessonsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/billing', billingRouter);
  // Relay executes commands: paid tier gate (enforced when REQUIRE_API_KEY=true).
  app.use('/api/relay', requireTier('pro'), relayRouter);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, '../../frontend/dist');
    const indexFile = path.join(distDir, 'index.html');

    if (fs.existsSync(indexFile)) {
      const staticLimiter = rateLimit({
        windowMs: 60_000,
        limit: 240,
        standardHeaders: true,
        legacyHeaders: false
      });

      app.use(express.static(distDir));
      app.get('*', staticLimiter, (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
          return next();
        }

        return res.sendFile(indexFile);
      });
    } else {
      console.warn('[startup warning] frontend/dist/index.html missing. Run `npm run build` before production start.');
    }
  }

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
