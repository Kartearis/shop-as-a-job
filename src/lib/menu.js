// Code-seeded menu (v1 has no in-app menu editor). Prices are in kopecks.
// Dishes are single products; combos bundle dishes at their own price.

export const SEED_MENU = [
  // --- Кофе ---
  { id: 'espresso', name: 'Эспрессо', type: 'dish', price: 15000, category: 'Кофе', active: true },
  { id: 'americano', name: 'Американо', type: 'dish', price: 17000, category: 'Кофе', active: true },
  { id: 'cappuccino', name: 'Капучино', type: 'dish', price: 22000, category: 'Кофе', active: true },
  { id: 'latte', name: 'Латте', type: 'dish', price: 24000, category: 'Кофе', active: true },

  // --- Напитки ---
  { id: 'tea', name: 'Чай', type: 'dish', price: 12000, category: 'Напитки', active: true },
  { id: 'orange_juice', name: 'Апельсиновый сок', type: 'dish', price: 20000, category: 'Напитки', active: true },
  { id: 'water', name: 'Вода', type: 'dish', price: 8000, category: 'Напитки', active: true },

  // --- Выпечка ---
  { id: 'croissant', name: 'Круассан', type: 'dish', price: 14000, category: 'Выпечка', active: true },
  { id: 'cheesecake', name: 'Чизкейк', type: 'dish', price: 26000, category: 'Выпечка', active: true },
  { id: 'sandwich', name: 'Сэндвич', type: 'dish', price: 23000, category: 'Выпечка', active: true },

  // --- Комбо ---
  {
    id: 'combo_breakfast',
    name: 'Завтрак',
    type: 'combo',
    price: 32000, // vs 22000 + 14000 = 36000 separately
    category: 'Комбо',
    active: true,
    components: [
      { itemId: 'cappuccino', quantity: 1 },
      { itemId: 'croissant', quantity: 1 },
    ],
  },
  {
    id: 'combo_lunch',
    name: 'Ланч',
    type: 'combo',
    price: 40000, // vs 23000 + 20000 + 8000 = 51000 separately
    category: 'Комбо',
    active: true,
    components: [
      { itemId: 'sandwich', quantity: 1 },
      { itemId: 'orange_juice', quantity: 1 },
      { itemId: 'water', quantity: 1 },
    ],
  },
]

/**
 * Resolve a combo's component list into display rows `{ itemId, name, quantity }`,
 * looking each name up in the menu. Falls back to the raw id when the referenced
 * dish is missing (e.g. a historical order whose menu item was later removed).
 */
export function describeComponents(components, menu) {
  const byId = new Map(menu.map((m) => [m.id, m]))
  return (components ?? []).map((c) => ({
    itemId: c.itemId,
    name: byId.get(c.itemId)?.name ?? c.itemId,
    quantity: c.quantity,
  }))
}

/**
 * Turn a display name into a slug usable as an id. Keeps unicode letters/digits
 * (so Cyrillic names stay readable), lowercases, collapses runs of other
 * characters to a single underscore. Never returns an empty string.
 */
export function slugify(name) {
  const slug = (name ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'item'
}

/**
 * Build a menu id from a name that is unique within `menu`. Appends `_2`, `_3`,
 * … on collision so re-adding a same-named item never duplicates an id.
 */
export function makeMenuId(name, menu) {
  const base = slugify(name)
  const taken = new Set(menu.map((i) => i.id))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

/**
 * Insert a new item or replace an existing one (matched by id). Pure: returns a
 * new array, preserving position on replace and appending on insert.
 */
export function upsertMenuItem(menu, item) {
  const exists = menu.some((i) => i.id === item.id)
  return exists
    ? menu.map((i) => (i.id === item.id ? item : i))
    : [...menu, item]
}

/**
 * Set an item's `active` flag (soft delete / restore). Pure: returns a new
 * array. The item stays in the menu so history, active orders and analytics —
 * which reference it by id — keep resolving its name.
 */
export function setMenuItemActive(menu, id, active) {
  return menu.map((i) => (i.id === id ? { ...i, active } : i))
}

/**
 * Open orders that reference an item directly as a line (used to warn before
 * saving edits). Combo lines are frozen snapshots, so editing a dish that is
 * merely a component of a combo in an order does not rewrite that order.
 */
export function activeOrdersUsingItem(orders, itemId) {
  return (orders ?? []).filter(
    (o) => o.status === 'open' && (o.lineItems ?? []).some((l) => l.itemId === itemId),
  )
}

/**
 * Validate a menu's integrity. Returns an array of error strings (empty = ok):
 * unique ids, positive prices, and combo components that reference real dishes.
 */
export function validateMenu(menu) {
  const errors = []
  const byId = new Map()

  for (const item of menu) {
    if (byId.has(item.id)) errors.push(`Duplicate id: ${item.id}`)
    byId.set(item.id, item)
    if (!(item.price > 0)) errors.push(`Non-positive price: ${item.id}`)
    if (item.type !== 'dish' && item.type !== 'combo') {
      errors.push(`Unknown type on ${item.id}: ${item.type}`)
    }
  }

  for (const item of menu) {
    if (item.type !== 'combo') continue
    if (!item.components?.length) {
      errors.push(`Combo has no components: ${item.id}`)
      continue
    }
    for (const comp of item.components) {
      const target = byId.get(comp.itemId)
      if (!target) {
        errors.push(`Combo ${item.id} references missing item: ${comp.itemId}`)
      } else if (target.type !== 'dish') {
        errors.push(`Combo ${item.id} references non-dish: ${comp.itemId}`)
      }
      if (!(comp.quantity > 0)) {
        errors.push(`Combo ${item.id} has non-positive component qty: ${comp.itemId}`)
      }
    }
  }

  return errors
}
