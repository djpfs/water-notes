# Water Notes

PWA de hidratação — Vue 3 + Pinia + Tailwind.

## Local

```bash
npm install
npm run dev
npm run build
```

## Cloudflare (Worker + static assets)

Crie um **Worker** (não Pages) ligado ao repo, ou no projeto atual use:

| Campo | Valor |
|-------|--------|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

O `wrangler.toml` serve a pasta `dist` com fallback SPA.
