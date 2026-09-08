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
