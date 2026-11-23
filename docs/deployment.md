# Deployment

## Frontend (Vercel)

Deploy `/frontend` as a Vite app with:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-backend.example.com`

## Backend (separate host)

Host the Node backend separately (Railway/Render/Fly/VPS/etc.). Required env vars:

- `PORT`
- `DATABASE_URL`
- `NODE_ENV=production`
- `VITE_API_BASE_URL` (optional, used for ws URL derivation in client)

Start command:

```bash
npm run start:prod
```

In production mode the backend serves `frontend/dist` when present and logs a startup warning when missing.

## License store (Stripe webhook -> license keys)

The webhook and the `/api/relay` gate need a persistent, transactional store. Unconfigured means fail closed
(webhook 503, webhook-issued `FZ-` keys denied; `API_KEYS` env keys keep working).

| Env | Store | Use when |
|---|---|---|
| `LICENSE_DATABASE_URL=postgres://...` (+ `LICENSE_DATABASE_SSL=require`, `LICENSE_DB_POOL_MAX`) | Postgres (`pg`, already a dependency) | **Default recommendation**: reuse the app's `DATABASE_URL`. Works on ephemeral/serverless/multi-instance hosts. Tables `license_events`, `licenses`, `license_outbox` are created on first use (separate from the waitlist and the `migrate` script). |
| `LICENSE_DB=/data/licenses.sqlite` | SQLite (`node:sqlite`, Node >= 22.5, ExperimentalWarning) | One server with a persistent volume. Wrong for ephemeral disks. |
| `LICENSE_DB=./data/licenses.json` | JSON file | Local/dev only, single process. |

Owner CLI (uses the same env): `node scripts/license-outbox.js list`, `delivered <hash> --approver "<name>"`,
`migrate-json <file>` (import an old `licenses.json`; idempotent, keys stay valid).

Limits: the plaintext key sits in `license_outbox` until you mark it delivered, so protect the database like a secret store
(nothing is encrypted at rest). Not tested against managed Postgres poolers (Neon/Supabase) or live Stripe; tested with real
SQLite only here (the shared module's Postgres tests ran upstream, not in this repo).
