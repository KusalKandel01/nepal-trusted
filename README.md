# Nepal Trusted Site Directory

A checked, searchable directory of Nepal's e-commerce platforms — flagged by
trust level and delivery coverage outside the Kathmandu Valley (Chitwan,
Gaindakot, and beyond) — with a 3D delivery-network visualization and a
"known problems" reference panel.

## Project structure

```
nepal-trusted-directory/
├── public/                # Everything a static host needs — deploy this folder as-is
│   ├── index.html         # Markup only, no inline scripts/styles
│   ├── style.css           # All styling
│   ├── main.js              # App logic: fetches sites.json, renders, wires up UI
│   ├── scene.js              # 3D hero (Three.js), isolated as its own module
│   ├── sites.json              # Source of truth for directory data — edit this to add/update sites
│   ├── manifest.json            # Make the site installable (PWA-lite)
│   ├── icon.svg                  # Favicon / app icon
│   ├── robots.txt                 # Search engine crawl rules
│   ├── sitemap.xml                 # Search engine sitemap
│   └── 404.html                     # Branded not-found page
├── server/
│   └── server.js           # Optional Node/Express server (static hosting + a small JSON API)
├── package.json           # npm scripts + dependencies for the Node server
├── netlify.toml            # Zero-config Netlify deploy
├── vercel.json               # Zero-config Vercel deploy
└── .gitignore
```

The site is a **pure static site** — `public/` will work on any static host
with zero build step. `server/server.js` is optional, for anyone who wants
a real Node backend (e.g. to later move `sites.json` into a database and
serve it from `/api/sites` instead of a flat file).

## Running it locally

You need to serve the files over `http://`, not open `index.html` directly
from disk — browsers block `fetch()` of local JSON files under the `file://`
protocol. Pick one:

**Option A — Node/Express (included):**
```bash
npm install
npm start
# → http://localhost:3000
```

**Option B — any static server, no Node needed:**
```bash
cd public
python3 -m http.server 8080
# → http://localhost:8080
```

**Option C — VS Code:** install the "Live Server" extension, right-click
`public/index.html`, choose "Open with Live Server."

If you genuinely do open `index.html` straight from disk, the app still
works — `main.js` detects the failed fetch and falls back to a small
embedded dataset, with a visible notice so you know why the list is short.

## Deploying it for real

**Netlify (drag-and-drop or Git-connected):**
- Drag the whole project folder onto app.netlify.com/drop, or
- Connect the Git repo — `netlify.toml` already points the build at `public/`

**Vercel:**
- Import the Git repo — `vercel.json` already points the output at `public/`

**GitHub Pages:**
- Push this repo, then in Settings → Pages, set the source to the `public/`
  folder on your default branch (or copy `public/*` to the repo root if your
  Pages setup requires that).

**A real Node host (Render, Railway, Fly.io, a VPS, etc.):**
- Use `server/server.js` — `npm install && npm start` — and set the `PORT`
  environment variable if your host requires a specific one.

## Before you go live

- [ ] Replace `your-domain-here.example` in `public/index.html`
      (`<link rel="canonical">`), `public/robots.txt`, and `public/sitemap.xml`
      with your real domain.
- [ ] Update the `<meta property="og:image">` tag if you want a real social
      preview image (currently points at the small SVG icon).
- [ ] Review `public/sites.json` — prices, delivery claims and trust flags
      were compiled from public information at a point in time and will
      drift. Treat this as a starting point to keep current, not a
      permanent source of truth.

## Editing the directory

All listings live in `public/sites.json` (and are mirrored to
`server/server.js`'s `/api/sites` response, which reads the same file — so
you only ever need to edit one place). Each entry:

```json
{
  "cat": "Category shown as a filter chip",
  "name": "Display name",
  "url": "https://...",
  "delivery": "nationwide | mostly | limited",
  "deliveryLabel": "Short label shown on the card",
  "note": "One or two sentences of context",
  "trust": "verified | caution | flag"
}
```

## Product search across sites — what it actually does

Typing a product and hitting "Search all sites" does **not** scrape or display
live results/prices in-page. There's no public product-search API for any of
these platforms, and client-side scraping is blocked by CORS (server-side
scraping would also be fragile and against most sites' terms of service).

What it genuinely does: builds each site's own search-results URL for the
exact query you typed and opens it in a new tab — a real, working shortcut
that replaces typing the same query into nine different search boxes.

Each result is tagged with a confidence badge:
- **Confirmed pattern** — verified against the site's actual URL structure.
- **Best-guess — verify** — inferred from common platform conventions (most
  small Nepali shops run WooCommerce, whose default search is `?s=query`).
  These should work for most sites but haven't been individually confirmed,
  so double-check the results landed on the right page.

Search patterns live in `sites.json` under `searchUrl` (`{q}` is replaced
with the encoded query) and `searchConfidence`.

## The 3D background — now page-wide, not hero-only

The Three.js scene (`scene.js`) is a `position: fixed` canvas covering the
entire viewport, sitting behind every section for the full scroll length —
not just the hero. A gradient scrim (`.bg-scrim`) sits between the canvas
and the content so text stays readable while the terrain is still visible
through the translucent "glass" panels (search box, known-problems panel).

Two things tie the 3D to the rest of the page instead of it just running
in the background unrelated to what you're doing:
- **Scroll-linked camera** — as you scroll down, the camera pulls back and
  the focal point drifts toward the southern (Terai) markers.
- **3D card tilt** — directory cards tilt in real 3D (`perspective` +
  `rotateX/rotateY`) following the pointer, on top of the shared 3D canvas
  behind them.

Both respect `prefers-reduced-motion` — the tilt is skipped entirely, and
the whole 3D layer falls back to the original static gradient background.

## Accessibility & performance notes

- Respects `prefers-reduced-motion` and `navigator.connection.saveData` —
  the 3D hero is skipped entirely for those users, falling back to a static
  gradient background.
- Skip-to-content link, visible focus states, `aria-live` regions for
  search results and toasts, `aria-expanded`/`aria-pressed` on interactive
  controls.
- 3D render loop pauses when the browser tab isn't visible.
- Pixel ratio capped and particle count reduced on narrow viewports.
- If the Three.js CDN import fails (offline, blocked, slow network), the
  page degrades to the static hero instead of breaking.

## License

MIT — do whatever you want with it.
