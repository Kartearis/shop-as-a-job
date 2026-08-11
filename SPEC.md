# Shop as a Job — Cafe Receipt & Stock Management

A handheld (phone/tablet) web app for running the counter of a small cafe:
take orders, track what's been sold, and read back basic analytics. Runs fully
offline as a PWA; all data lives on the device in `localStorage`. There is no
backend and no network dependency.

---

## 1. Goals & scope

**In scope**

- **Order management** — build an order from the menu, see all live orders, edit
  an order after it's opened.
- **Stock management** — track the cumulative quantity ordered for each menu item.
- **Analytics** — persist every order to history and report totals, best sellers,
  revenue, and customer density over time.

**Out of scope (v1)**

- Multi-device sync / shared state (data is per-device only).
- Payment processing, printing, tax/discount rules.
- User accounts, roles, authentication.
- Menu editing UI (the menu is seeded in code for v1 — see Open Questions).

**Target device.** Primary form factor is a handheld touchscreen (≈360–768px
wide), portrait. Touch targets ≥ 44px, single-column layouts, thumb-reachable
primary actions. Must also be usable on a tablet.

---

## 2. Domain model

All entities are plain JSON persisted in `localStorage`. Money is stored in
**integer minor units — kopecks (RUB × 100)** — to avoid floating-point drift;
formatting to a `₽` string happens only at display time, via `ru-RU` locale
(`Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })`).

### Item
An item is either a **dish** (a single product with its own price) or a **combo**
(a named bundle of several dishes, sold at its own combo price — typically a
discount on the components). Both live in the same menu list, discriminated by
`type`.

| field        | type              | notes                                                    |
|--------------|-------------------|----------------------------------------------------------|
| `id`         | string            | uuid                                                     |
| `name`       | string            | e.g. "Капучино" / "Завтрак"                              |
| `type`       | enum              | `dish` \| `combo`                                        |
| `price`      | integer           | the price charged for this item (kopecks)                |
| `category`   | string            | optional grouping (e.g. "Кофе")                          |
| `active`     | boolean           | inactive items hidden from ordering                      |
| `components` | ComponentRef[]    | **combo only** — the dishes it contains                  |

### ComponentRef (combo contents)
| field        | type    | notes                              |
|--------------|---------|------------------------------------|
| `itemId`     | string  | references a `dish` Item            |
| `quantity`   | integer | how many of that dish in the combo  |

**Combo pricing.** A combo carries its own `price` (what the customer pays); it is
**not** derived from the sum of its components. Components exist so that a combo
sale can be *exploded* into the underlying dishes for stock and per-dish analytics
(see §3.2 / §3.3). Combos may only contain dishes, not other combos (no nesting).

### Order
| field          | type          | notes                                        |
|----------------|---------------|----------------------------------------------|
| `id`           | string        | uuid                                          |
| `customerName` | string        | required                                      |
| `createdAt`    | string (ISO)  | set when order is opened                       |
| `updatedAt`    | string (ISO)  | bumped on every edit                           |
| `status`       | enum          | `open` \| `completed` \| `cancelled`           |
| `free`         | boolean       | promotional order — charged `0`, see below     |
| `lineItems`    | LineItem[]    | see below                                      |
| `total`        | integer       | derived nominal value (sum of line totals)     |

**Free / promotional orders.** A per-order switch marks an order `free`. A free
order is built exactly like any other (items, quantities, customer name), and its
`total` still holds the **nominal** value of its contents — but the amount
**charged** is `0`. Derive:

- `order.charged = order.free ? 0 : order.total`

Free orders **still count toward stock** (the dishes were really made — see §3.2)
and are **reported separately** in analytics as promotions, including the total
nominal value given away. They never contribute to revenue.

### LineItem
A **snapshot** of the item at time of ordering, so later menu/price/combo changes
never rewrite historical orders. For a combo line, the snapshot also freezes the
component breakdown, so stock explosion (§3.2) stays stable even if the combo is
later redefined.

| field         | type            | notes                                              |
|---------------|-----------------|----------------------------------------------------|
| `itemId`      | string          | reference back to the Item                          |
| `name`        | string          | snapshot of item name                               |
| `type`        | enum            | `dish` \| `combo` (snapshot)                        |
| `unitPrice`   | integer         | snapshot of price (kopecks)                          |
| `quantity`    | integer         | ≥ 1                                                 |
| `components`  | ComponentRef[]  | **combo only** — snapshot of contents at order time |
| `lineTotal`   | integer         | derived: `unitPrice * quantity`                     |

**Derivations (never hand-maintained):**
- `lineItem.lineTotal = unitPrice * quantity`
- `order.total = Σ lineItem.lineTotal`

### Persistence (IndexedDB)
Two keys/stores in a single IndexedDB database (e.g. via `idb-keyval`):
- `cafe.menu` → `Item[]` (dishes and combos)
- `cafe.orders` → `Order[]` (all orders; live views filter by `status`)

> Stock counts and analytics are **computed from `cafe.orders`**, not stored
> separately — a single source of truth avoids the two-copies-drift problem. If
> profiling later shows this is slow, add a memoized cache; do not duplicate state
> prematurely.

---

## 3. Features

### 3.1 Order management

**Create order**
1. Enter **customer name** (required); `createdAt` is stamped automatically.
2. Browse the menu (grouped by category, search/filter by name).
3. Tap an item to add it; tapping again increments quantity. Quantity is also
   editable directly (stepper − / +).
4. A running **order list** shows each line (name × qty = line total) and the
   **grand total**, live.
5. A **"Free / promo"** switch marks the whole order promotional: the total is
   shown struck-through with **₽0 charged**, but contents are unchanged.
6. Save → order is stored with `status: open`.

**Current orders**
- A list/table of all `open` orders, each showing customer name, **elapsed time
  since `createdAt`** (live-updating timer), item count, and total.
- Sorted oldest-first (longest-waiting at top) by default.
- Tap an order to open its detail / edit view.
- Actions per order: **Edit**, **Complete**, **Cancel**.

**Edit order**
- Add/remove items, change quantities, edit customer name.
- `updatedAt` is bumped; `total` recomputed on save.
- Completing an order sets `status: completed` and keeps it in history; it leaves
  the "current orders" view but remains in analytics.
- Cancelling sets `status: cancelled` (excluded from sales/revenue analytics but
  retained for auditing).

### 3.2 Stock management

> "Stock" here means a **cumulative count of units sold** (it only ever goes up),
> not a depleting on-hand inventory. There are no starting counts, restocks, or
> low-stock warnings in v1.

- For each **dish**, show the **cumulative quantity ordered** across all
  non-cancelled orders. A combo sale is **exploded** into its component dishes:
  ordering 1× a "Завтрак" combo containing 1 coffee + 1 croissant adds **1 to
  coffee and 1 to croissant** (multiplied by line quantity and component
  quantity). This is why the LineItem freezes its `components` snapshot.
  Formally, dish count = Σ over non-cancelled line items of
  `lineQty × componentQty` (a dish line is treated as one component of itself).
  **Free/promotional orders are included** here — the food was still made.
- Combos are also listed at the combo level (how many of each combo sold), shown
  separately from the exploded dish totals so both readings are available.
- Presented as a sortable list (by quantity sold, descending = best sellers).
- **Optional extension (flagged, not required for v1):** an on-hand stock level
  per item with a starting count, decremented as items sell, and a low-stock
  warning threshold. Left out of v1 because the brief specifies "tracks total
  orders of each item," which is cumulative sales, not inventory depletion. See
  Open Questions.

### 3.3 Analytics

Computed from full order history (`cafe.orders`), scoped by a selectable date
range (default: today).

- **Per-item totals** — quantity sold and revenue contributed. Reported two ways:
  by **item as sold** (dishes and combos as line items) and by **exploded dish**
  (combos broken into components). Revenue is always attributed to the line's
  charged price (the combo price), never double-counted across its components;
  lines in `free` orders contribute quantity but **₽0 revenue**.
- **Total revenue** — Σ `order.charged` over the range (excludes `cancelled` and
  is `0` for `free` orders).
- **Promotions** — count of free orders and the total **nominal value given away**
  (Σ `total` of free orders), reported separately from revenue.
- **Order count & average order value** (paid orders only, to avoid free orders
  dragging the average to zero).
- **Customer density distribution** — orders bucketed by **hour of day** (and by
  day for wider ranges), rendered as a bar chart to reveal peak times.
- **Best/worst sellers** — ranked item list.

All figures recompute reactively from the same order store used everywhere else.

---

## 4. Screens & navigation

Bottom tab bar (thumb-reachable), four destinations:

1. **New Order** — create flow (§3.1).
2. **Orders** — current/live orders (§3.1), the default landing screen.
3. **Stock** — cumulative sales per item (§3.2).
4. **Analytics** — reports with date-range picker (§3.3).

Order detail/edit is a full-screen view pushed from **Orders** or **New Order**.

---

## 5. Non-functional requirements

- **Offline-first PWA.** Already scaffolded via `vite-plugin-pwa` (precache +
  navigation fallback). The app must fully function with the network disabled,
  including cold start after first load.
- **Local persistence.** All data on-device in **IndexedDB**; writes
  debounced/batched via a reactive composable (ref ↔ async store). This **replaces
  the scaffold's `src/useLocalStorage.js`**, which was fine for the demo but caps
  at ~5MB.
- **Data safety.** Because there's no backend, guard against data loss: wrap reads
  in try/catch (fall back to defaults on corruption), and offer an **Export /
  Import JSON** action so the operator can back up the day's data.
- **Retention.** Monitor storage use (`navigator.storage.estimate()` where
  available, else byte length of the serialized store). As usage approaches
  **~50MB**, **warn the operator and prompt an export-to-JSON**, then allow
  clearing old completed orders. No silent data drop.
- **Performance.** Analytics over a day's orders (hundreds of records) must feel
  instant on a mid-range phone; compute with plain reduces over the array.
- **UI components.** Use `reka-ui` primitives (Tabs, Dialog, Checkbox, Separator,
  NumberField/stepper, etc.) styled to the existing dark theme.

---

## 6. Tech stack (existing)

Vue 3 (`<script setup>`) · Vite 7 · `vite-plugin-pwa` · `reka-ui` · **IndexedDB**
(e.g. `idb-keyval`) behind a reactive composable — replacing the scaffold's
`src/useLocalStorage.js`. No router yet — add `vue-router` for the tabbed
navigation, or a lightweight `ref`-based view switch for v1.

---

## 7. Suggested build order

1. Swap persistence to an **IndexedDB-backed reactive composable** (replace
   `src/useLocalStorage.js`); keep the same `ref ↔ store` ergonomics.
2. Replace the demo `App.vue` with the tab shell + routing.
3. Seed a menu (`cafe.menu`) and build the **New Order** flow end-to-end.
3. **Orders** list with live elapsed-time timers + edit/complete/cancel.
4. **Stock** view (derived counts).
5. **Analytics** with date range + hourly density chart.
6. Export/Import JSON backup.

---

## 8. Resolved

- **Currency & locale** — RUB, `ru-RU` formatting (`₽`); stored internally in
  kopecks.
- **Items** — two kinds: `dish` (single, own price) and `combo` (bundle of dishes,
  own price); orders are collections of item lines with a customer name and order
  datetime.
- **Stock** — cumulative units-sold count (combos explode into component dishes);
  no on-hand inventory / restock / low-stock in v1.
- **Free orders** — per-order promotional switch; counts toward stock, ₽0 revenue,
  tracked separately as promotions.
- **Menu source** — **code-seeded** for v1; no in-app menu/combo editing screen.
- **Order lifecycle** — `open` → `completed` (set from the live-orders screen) or
  `cancelled`. Completed orders leave the live view but appear in history and
  statistics.
- **Timezone** — timestamps stored as ISO strings, displayed in the **device's
  local timezone**. For the target cafe this is Moscow anyway, and device-local
  needs no hardcoded offset.
- **Storage engine & retention** — **IndexedDB** (not `localStorage`), to allow
  history to grow toward ~**50MB**. Warn and prompt export-to-JSON as usage nears
  the cap; then allow clearing old completed orders. Requires replacing the
  scaffold's `localStorage` composable — see §5, §6.

## 9. Open questions

_None outstanding — all clarified. Any new questions from implementation will be
appended here._
