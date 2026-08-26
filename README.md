# Water Notes

PWA de hidratação — Vue 3 + Pinia + Tailwind.

## Local

```bash
npm install
npm run dev
npm run build
```

## Cloudflare Pages

Build settings:

| Campo | Valor |
|-------|--------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Deploy command | `npx wrangler pages deploy dist --project-name=water-notes` |

Não use `wrangler deploy` (isso é Worker). Use `wrangler pages deploy`.
