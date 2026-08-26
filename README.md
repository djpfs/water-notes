# Water Notes

PWA de hidratação — Vue 3 + Pinia + Tailwind + Cloudflare Worker/D1.

## Local (frontend)

```bash
npm install
npm run dev
```

## Auth + D1 (Worker)

1. Crie o banco:

```bash
npm run db:create
```

Cole o `database_id` em [`wrangler.toml`](wrangler.toml).

2. Migrações:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

3. Secrets (produção):

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put AUTH_SECRET
```

Local: copie `.dev.vars.example` → `.dev.vars`.

4. Google Cloud Console → OAuth Client (Web):
   - Authorized redirect URIs:
     - `https://water-notes.<seu-subdominio>.workers.dev/api/auth/callback`
     - `http://127.0.0.1:8787/api/auth/callback` (dev)

5. Suba API + assets:

```bash
# terminal 1 — API
npm run dev:worker

# terminal 2 — Vite (proxy /api → 8787)
npm run dev
```

6. Deploy:

```bash
npm run deploy
```

## Cloudflare build settings

| Campo | Valor |
|-------|--------|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

App continua **local-first**; Google + D1 sincronizam sob demanda em Ajustes.
