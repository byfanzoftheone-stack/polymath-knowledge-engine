# Monetization Plan (DRAFT - needs owner approval)

## What it is
Polymath Knowledge Engine: a curriculum-driven learning system (lessons, sessions, a command-relay API with live WebSocket updates, React frontend).

## Who pays
- Self-directed learners / career switchers (Pro).
- Bootcamps, tutors, small training teams who want custom curricula and the relay API (Team).
- Developers embedding the relay/session API in their own tools (API key holders).

## Pricing tiers (PLACEHOLDERS - owner must approve; configurable via `PRICE_*_USD`)
| Tier | Price | Includes |
|---|---|---|
| Free | $0 | Browse curriculum, community support |
| Pro | $19/mo | Relay command API, live session relay, email support |
| Team | $99/mo | Everything in Pro, higher rate limits, custom curricula |

## Revenue paths
1. Subscriptions via Stripe Checkout (`POST /api/billing/checkout`, off until enabled).
2. API-key sales: keys with `pro`/`team` tier unlock `/api/relay` (`REQUIRE_API_KEY=true`).
3. Paid custom curriculum authoring / onboarding for Team customers.
4. Waitlist first (`POST /api/billing/waitlist`) to validate demand before turning on payments.

## Launch checklist (owner actions)
- [ ] Approve or change prices and tier names.
- [ ] Provision Postgres; run `npm run migrate` (adds `waitlist` table).
- [ ] Deploy backend and frontend (see docs/deployment.md); set `NODE_ENV=production`, `TRUST_PROXY=true` behind a proxy, `CORS_ORIGIN`.
- [ ] Create Stripe products/prices; set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM` in host secrets (never in git).
- [x] Stripe webhook -> license keys built (`POST /api/stripe/webhook`, vendored from the shared `license-webhook` module). Owner: set `STRIPE_WEBHOOK_SECRET` and a license store (recommended: `LICENSE_DATABASE_URL` = your existing `DATABASE_URL`; or `LICENSE_DB=/data/licenses.sqlite` on a persistent volume), point a Stripe endpoint at the route, test in test mode. With no store configured the webhook returns 503 and issued keys are denied. Existing JSON data: `node scripts/license-outbox.js migrate-json ./data/licenses.json`.
- [ ] Deliver issued keys by hand: `node scripts/license-outbox.js list`, send the key yourself, then `node scripts/license-outbox.js delivered <hash> --approver "<name>"`. Nothing is emailed automatically.
- [ ] Set `REQUIRE_API_KEY=true`; issue keys to first customers.
- [ ] Set `CHECKOUT_ENABLED=true` only after a test-mode purchase succeeds.
- [ ] Publish terms, privacy policy, refund policy.
- [ ] Review and send LAUNCH.md copy yourself.
