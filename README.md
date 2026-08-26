# Water Notes

PWA de hidratação — Vue 3 + Pinia + Tailwind.

## Local

```bash
npm install
npm run dev
npm run build
```

## Cloudflare Pages

1. Push do código para o GitHub (`djpfs/water-notes`)
2. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Repo: `water-notes`
4. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/`
5. Deploy → URL tipo `https://water-notes.pages.dev`

SPA: `public/_redirects` já redireciona rotas do Vue Router para `index.html`.
