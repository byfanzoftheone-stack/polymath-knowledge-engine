const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');

const healthRouter = require('./routes/health');
const lessonsRouter = require('./routes/lessons');
const sessionsRouter = require('./routes/sessions');
const relayRouter = require('./routes/relay');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/api/lessons', lessonsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/relay', relayRouter);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, '../../frontend/dist');
    const indexFile = path.join(distDir, 'index.html');

    if (fs.existsSync(indexFile)) {
      app.use(express.static(distDir));
      app.get('*', (req, res, next) => {
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
