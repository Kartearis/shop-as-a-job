// Pure order-domain logic: building line items from menu items, computing
// totals, and the free/promotional charged amount. No I/O, no framework.

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

/** Derived line total in kopecks. Always recomputed, never trusted from cache. */
export function lineTotal(line) {
  return line.unitPrice * line.quantity
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
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
} = {}) {
  return {
    id,
    customerName,
    createdAt,
    updatedAt: createdAt,
    status: 'open',
    free,
    lineItems: [],
  }
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

/** Remove a line by item id. Returns a new array. */
export function removeLine(lines, itemId) {
  return lines.filter((l) => l.itemId !== itemId)
}
