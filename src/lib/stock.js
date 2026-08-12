// Stock = cumulative units sold (only ever goes up), computed from order
// history. Combo sales explode into their component dishes; combos are also
// counted at the combo level. Cancelled orders are excluded; free orders are
// included (the food was still made).

function isCounted(order) {
  return order.status !== 'cancelled'
}

/**
 * Per-dish cumulative quantity sold, with combos exploded into components.
 * A dish line adds its quantity; a combo line adds, for each component,
 * `componentQty * lineQty`. Returns an object { dishId: quantity }.
 */
export function dishSoldCounts(orders) {
  const counts = {}
  const add = (id, qty) => {
    counts[id] = (counts[id] ?? 0) + qty
  }
  for (const order of orders) {
    if (!isCounted(order)) continue
    for (const line of order.lineItems) {
      if (line.type === 'combo') {
        for (const comp of line.components ?? []) {
          add(comp.itemId, comp.quantity * line.quantity)
        }
      } else {
        add(line.itemId, line.quantity)
      }
    }
  }
  return counts
}

/** Per-combo cumulative quantity sold (as sold, not exploded). */
export function comboSoldCounts(orders) {
  const counts = {}
  for (const order of orders) {
    if (!isCounted(order)) continue
    for (const line of order.lineItems) {
      if (line.type === 'combo') {
        counts[line.itemId] = (counts[line.itemId] ?? 0) + line.quantity
      }
    }
  }
  return counts
}

/**
 * A display-ready report: dishes (exploded) and combos, each as a list of
 * { id, name, qty } sorted by quantity desc then name. `menu` resolves names.
 */
export function stockReport(orders, menu = []) {
  const nameOf = (id) => menu.find((m) => m.id === id)?.name ?? id
  const toRows = (counts) =>
    Object.entries(counts)
      .map(([id, qty]) => ({ id, name: nameOf(id), qty }))
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'))

  return {
    dishes: toRows(dishSoldCounts(orders)),
    combos: toRows(comboSoldCounts(orders)),
  }
}
