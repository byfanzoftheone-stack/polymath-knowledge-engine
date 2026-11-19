const fs = require('node:fs');
const path = require('node:path');

const SENSITIVE = /(key|secret|token|password|authorization|email)/i;

function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  const out = Array.isArray(value) ? [] : {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

// Append-only JSON-lines audit log. Always logs to stdout; also to AUDIT_LOG_FILE if set.
function audit(action, details = {}) {
  const entry = { ts: new Date().toISOString(), action, ...redact(details) };
  const line = JSON.stringify(entry);
  if (process.env.NODE_ENV !== 'test') console.log(`[audit] ${line}`);
  const file = process.env.AUDIT_LOG_FILE;
  if (file) {
    try {
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      fs.appendFileSync(file, `${line}\n`);
    } catch (error) {
      console.error('[audit] failed to write audit file', error.message);
    }
  }
  return entry;
}

// Express middleware: audit every state-changing request (never bodies, only metadata).
function auditMiddleware(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    audit('http.request', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ip: req.ip,
      tier: req.auth ? req.auth.tier : 'anonymous'
    });
  });
  next();
}

module.exports = { audit, auditMiddleware, redact };
