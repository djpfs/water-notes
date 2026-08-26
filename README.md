# Water Notes

PWA de hidratação — Vue 3 + Pinia + Tailwind.

## Local

```bash
npm install
npm run dev
npm run build
```

## Cloudflare Pages

1. [Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → projeto
2. **Settings** → **Builds & deployments** (ou Build configuration):
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Deploy command:** deixe **vazio** (não use `wrangler deploy`)
3. Salve e faça **Retry deployment**

URL típica: `https://water-notes.pages.dev`
