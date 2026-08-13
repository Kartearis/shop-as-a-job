// Pure order-domain logic: building line items from menu items, computing
// totals, and the free/promotional charged amount. No I/O, no framework.

import { dayKey } from './time.js'

/**
 * Build an order line as a snapshot of a menu item. Combo lines also freeze
 * their component breakdown so later menu edits never rewrite history.
 */
export function makeLineItem(item, quantity = 1) {
  const line = {
    itemId: item.id,
    name: item.name,
    type: item.type,
    unitPrice: item.price,
    quantity,
  }
  if (item.type === 'combo') {
    line.components = (item.components ?? []).map((c) => ({
      itemId: c.itemId,
      quantity: c.quantity,
    }))
  }
  line.lineTotal = lineTotal(line)
  return line
}

/** Derived line total in kopecks. Always recomputed, never trusted from cache.
 * Missing price/quantity (e.g. legacy-corrupted lines) count as 0, never NaN. */
export function lineTotal(line) {
  return (line.unitPrice ?? 0) * (line.quantity ?? 0)
}

/** Nominal order total (sum of line totals), ignoring the free flag. */
export function orderTotal(order) {
  return order.lineItems.reduce((sum, line) => sum + lineTotal(line), 0)
}

/** Amount actually charged: 0 for free/promotional orders, else the total. */
export function orderCharged(order) {
  return order.free ? 0 : orderTotal(order)
}

/** Create a fresh open order. Callers may pass id/createdAt for determinism. */
export function createOrder({
  customerName = '',
  free = false,
  comment = '',
  delivery = false,
  address = '',
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
} = {}) {
  return {
    id,
    customerName,
    comment,
    delivery,
    address,
    createdAt,
    updatedAt: createdAt,
    status: 'open',
    free,
    lineItems: [],
  }
}

/**
 * Assign a per-day sequential number to each order, resetting at local
 * midnight. Orders are numbered by createdAt within their calendar day — all
 * statuses counted, so a number stays fixed as its order completes or cancels.
 * Returns a Map of order id -> number.
 */
export function dailyOrderNumbers(orders) {
  const perDay = new Map()
  const numbers = new Map()
  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  )
  for (const o of sorted) {
    const key = dayKey(o.createdAt)
    const n = (perDay.get(key) ?? 0) + 1
    perDay.set(key, n)
    numbers.set(o.id, n)
  }
  return numbers
}

/**
 * Add an item to a line-item array. If the item is already present its
 * quantity is incremented. Returns a new array (does not mutate the input).
 */
export function addLine(lines, item, quantity = 1) {
  const existing = lines.find((l) => l.itemId === item.id)
  if (existing) {
    return lines.map((l) =>
      l.itemId === item.id ? makeLineItem(item, l.quantity + quantity) : l,
    )
  }
  return [...lines, makeLineItem(item, quantity)]
}

/**
 * Set the quantity of a line by item id. A quantity <= 0 removes the line.
 * The `item` is needed to rebuild an accurate snapshot. Returns a new array.
 */
export function setLineQuantity(lines, item, quantity) {
  if (quantity <= 0) return removeLine(lines, item.id)
  const exists = lines.some((l) => l.itemId === item.id)
  if (!exists) return addLine(lines, item, quantity)
  return lines.map((l) =>
    l.itemId === item.id ? makeLineItem(item, quantity) : l,
  )
}

/**
 * Change the quantity of an existing line by item id, reusing the line's own
 * snapshot (name/price/components) so no menu lookup is needed. A quantity <= 0
 * removes the line; an unknown id is returned unchanged. Returns a new array.
 */
export function updateLineQuantity(lines, itemId, quantity) {
  if (quantity <= 0) return removeLine(lines, itemId)
  return lines.map((l) => {
    if (l.itemId !== itemId) return l
    const next = { ...l, quantity }
    next.lineTotal = lineTotal(next)
    return next
  })
}

/** Remove a line by item id. Returns a new array. */
export function removeLine(lines, itemId) {
  return lines.filter((l) => l.itemId !== itemId)
}
