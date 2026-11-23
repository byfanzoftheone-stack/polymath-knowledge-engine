# Governance

## Principle
Humans approve anything that spends money, publishes content, or contacts people. Automation (including AI agents) may draft, never send.

## Guardrails implemented in code
| Control | Where | Behaviour |
|---|---|---|
| Spend approval | `routes/billing.js` | Stripe is contacted only when `CHECKOUT_ENABLED=true` and Stripe env vars are set; otherwise 503 and an audit entry. |
| Paid-tier gating | `governance/apiKeys.js` | `/api/relay` requires a `pro`+ key when `REQUIRE_API_KEY=true`. Keys compared via SHA-256 + timing-safe equality. |
| Audit logging | `governance/audit.js` | JSON-lines to stdout and optional `AUDIT_LOG_FILE` for every state-changing request and billing event; keys/tokens/emails redacted. |
| Rate limits | `app.js`, `routes/billing.js` | 120 req/min/IP on `/api` (`API_RATE_LIMIT_PER_MIN`), 10/min on checkout and waitlist, static fallback limited. |
| Request size / CORS | `app.js` | 50kb JSON body cap; `CORS_ORIGIN` allowlist. |
| No secrets in code | `.env.example`, `.gitignore` | Placeholders only; `.env*` ignored; frontend only reads `VITE_API_BASE_URL` (verified no secrets in built bundle). |

## Policy (not enforced by code)
- Outbound messages (email, social, DMs): drafts in LAUNCH.md only; the owner sends them.
- No deploys, publishes, or price changes without owner sign-off.
- Rotate any key that appears in logs, commits, or chat.
- Review the audit log weekly; retain 90 days.

## Known gaps
- Relay commands are still simulated; add per-command allowlist/approval before connecting real execution.
- Audit log is not tamper-evident; ship it to external storage in production.
- Stripe webhook issues keys automatically (hash stored; plaintext queued until a human marks it delivered via `scripts/license-outbox.js`). It never emails or calls Stripe. Keys live in a transactional store (Postgres via `LICENSE_DATABASE_URL`, or SQLite on a persistent volume via `LICENSE_DB`): event claim, key issue and outbox write commit atomically, so concurrent duplicate events issue exactly one key; if no store is configured the gate fails closed (issued keys denied, webhook 503; env `API_KEYS` still work); webhook-issued keys are revoked on subscription deletion, payment failure or refund. Not tested against live Stripe.
- Rate limiting is per-process memory; use a shared store if running multiple instances.
