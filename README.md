# Warta

An editorial-style RSS reader with a magazine layout. No build step — open `index.html` in a browser and it works.

![screenshot placeholder](https://placehold.co/900x500/FAF7F2/111111?text=Warta)

## Features

- **Magazine grid layout** — articles arranged as hero, wide, and card types based on position and image availability
- **RSS/Atom feed support** — add any RSS or Atom feed URL; validated live before saving
- **Remote feed list** — curated feeds and categories loaded automatically from [`web-data-store`](https://github.com/farizdp/web-data-store) on startup
- **Categories** — organize feeds into color-coded categories
- **Reader pane** — read sanitized article content in-app without leaving
- **Star & read tracking** — bookmark articles and track what you've read
- **Bilingual UI** — Indonesian and English, switchable at runtime
- **Dark mode** — full dark theme with smooth transitions
- **Responsive** — works on mobile with a drawer sidebar

## Usage

1. Open `index.html` in any modern browser
2. Click **+** (bottom-right) to add an RSS feed URL
3. Feeds are validated automatically; choose a category and save
4. Click any article card to open the reader pane
5. Use the sidebar to filter by view (All, Unread, Starred) or category

All data is stored in `localStorage` — no server or account required.

## Remote Feed List

The curated feed list is managed in a separate repo and loaded automatically on every page open:

**Source file:** [`web-data-store/warta-rss/feeds.json`](https://github.com/farizdp/web-data-store/blob/main/warta-rss/feeds.json)

To add, remove, or rename a feed, edit that file and push — all browsers pick it up on next load.

The sync is additive: remote feeds are merged into local state, so any feeds you add manually in the UI are preserved. If the fetch fails (offline), the app falls back to whatever is in `localStorage`.

## Tech

- Vanilla JS (single IIFE, no framework)
- CSS custom properties for theming
- [rss2json.com](https://rss2json.com) API proxy for feed fetching
- [DOMPurify](https://github.com/cure53/DOMPurify) for HTML sanitization
- [jsDelivr](https://www.jsdelivr.com) CDN for serving the remote feed list
