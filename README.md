# polymath-knowledge-engine

Curriculum-driven learning system with:

- Node/Express backend API
- PostgreSQL schema/migrations/seeding
- WebSocket live relay
- React/Vite frontend
- Vercel-ready frontend + separately hosted backend deployment

## Repository structure

- `backend/` API, relay, queue, worker, DB integration
- `frontend/` React/Vite app
- `docs/` architecture, schema, deployment notes
- `scripts/` bootstrap automation
- `.github/workflows/ci.yml` CI for backend tests + frontend build

## One-command bootstrap

```bash
bash /home/runner/work/polymath-knowledge-engine/polymath-knowledge-engine/bootstrap-and-launch.sh
```

## Launch scripts

- Development local: `bash bootstrap-and-launch.sh`
- Production-style local: `bash bootstrap-and-launch-prod.sh`
- Termux/no-Docker local: `bash bootstrap-and-launch-termux.sh`

## Manual commands

```bash
npm run bootstrap
npm run migrate:reset
npm run seed
npm run dev
```

Production local API-only run after building frontend:

```bash
npm run build
npm run start:prod
```

## Environment

Copy `.env.example` to `.env` (bootstrap does this automatically).

- `VITE_API_BASE_URL` blank by default; in production set this to your backend URL if frontend and backend are split hosts.
- Backend serves `frontend/dist` in production when present and warns at startup if missing.

## Vercel + separate backend

- Deploy `frontend/` on Vercel.
- Set frontend env var `VITE_API_BASE_URL=https://your-backend-domain`.
- Deploy backend separately with `PORT`, `DATABASE_URL`, `NODE_ENV=production`.
