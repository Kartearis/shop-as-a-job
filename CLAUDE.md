# CLAUDE.md

Guidance for working in this repository.

## Project

Offline-first PWA for a small cafe: take orders, track what's sold, view analytics.
Vue 3 (`<script setup>`) + Vite, `reka-ui` for headless UI primitives (Tabs, Dialog,
Switch), and IndexedDB (via `idb-keyval`) as the only persistence layer — there is no
backend.

## Layout

- `src/lib/` — pure domain logic, no framework or I/O. `orders.js` (line items,
  totals), `menu.js` (seed menu + validation), `stock.js`, `analytics.js`,
  `money.js` (integer kopecks), `time.js`. Prefer putting logic here and unit-testing it.
- `src/composables/` — `useIdbRef.js` (reactive ref persisted to IndexedDB) and
  `useStore.js` (app-wide singleton store: menu + order history).
- `src/views/` + `src/components/` — the UI. Money is stored as integer kopecks
  everywhere and only formatted to a `₽` string via `money.js`.

## Conventions

- Money is **integer kopecks** end to end; never do floating-point math on rubles.
- Line items are **snapshots** of a menu item taken at order time (name/price/combo
  breakdown frozen) so later menu edits don't rewrite history. Treat historical order
  data as possibly imperfect — guard against missing fields rather than assuming a
  well-formed snapshot (some early data has lines missing `name`/`unitPrice`).
- `lib/` functions are pure and return new arrays/objects (no mutation).

## Testing

- Unit/component tests use Vitest + `@vue/test-utils` (jsdom, `fake-indexeddb`).
  Run with `npm test`. Add a test in `tests/` for any `lib/` change.
- **Also verify UI/runtime behavior with a real browser before declaring a fix done.**
  The unit tests won't catch reka-ui lifecycle bugs, IndexedDB hydration issues, or
  rendering glitches. Drive the running app with Puppeteer:
  1. `npm run dev` (serves at http://localhost:5173/).
  2. `npm install --no-save puppeteer-core` and launch the installed Chrome via
     `executablePath` (e.g. `C:\Program Files\Google\Chrome\Application\chrome.exe`) —
     no browser download needed.
  3. Attach `page.on('console'...)` and `page.on('pageerror'...)` listeners and fail
     the script on any error — several bugs here only surface as console errors.
  4. To exercise data-dependent views (orders/stock/analytics), inject fixtures
     straight into IndexedDB (`idb-keyval` uses db `keyval-store`, store `keyval`,
     keys `cafe.menu` / `cafe.orders`), then reload so the store hydrates them.
  5. Clean up afterward: remove the temp script and `npm remove puppeteer-core`.
