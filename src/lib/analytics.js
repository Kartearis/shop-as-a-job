// Analytics computed from order history, scoped to a date range. Revenue uses
// the charged amount (free orders = 0); promotions are reported separately;
// customer density buckets orders by local hour of day.

import { orderTotal, orderCharged, lineTotal } from './orders.js'
import { dishSoldCounts } from './stock.js'

const notCancelled = (o) => o.status !== 'cancelled'

/**
 * Filter orders whose createdAt falls in [from, to). Bounds are optional
 * (missing = unbounded) and may be Date objects or ISO strings.
 */
export function ordersInRange(orders, { from, to } = {}) {
  const lo = from != null ? new Date(from).getTime() : -Infinity
  const hi = to != null ? new Date(to).getTime() : Infinity
  return orders.filter((o) => {
    const t = new Date(o.createdAt).getTime()
    return t >= lo && t < hi
  })
}

/** Total money taken: sum of charged amounts over non-cancelled orders. */
export function totalRevenue(orders) {
  return orders.filter(notCancelled).reduce((s, o) => s + orderCharged(o), 0)
}

/** Free/promotional summary: how many, and the nominal value given away. */
export function promotions(orders) {
  const free = orders.filter((o) => notCancelled(o) && o.free)
  return {
    count: free.length,
    valueGivenAway: free.reduce((s, o) => s + orderTotal(o), 0),
  }
}

/** Paid-order stats: count, revenue and average order value (kopecks). */
export function orderStats(orders) {
  const paid = orders.filter((o) => notCancelled(o) && !o.free)
  const revenue = paid.reduce((s, o) => s + orderTotal(o), 0)
  return {
    paidOrders: paid.length,
    revenue,
    averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
  }
}

/**
 * Per-item totals "as sold" — dishes and combos as their own line items.
 * Quantity counts free orders; revenue is 0 for free orders (never split
 * across combo components). Returns { itemId: { id, name, type, qty, revenue } }.
 */
export function itemsSold(orders) {
  const acc = {}
  for (const o of orders) {
    if (!notCancelled(o)) continue
    for (const line of o.lineItems) {
      const row = (acc[line.itemId] ??= {
        id: line.itemId,
        name: line.name,
        type: line.type,
        qty: 0,
        revenue: 0,
      })
      row.qty += line.quantity
      if (!o.free) row.revenue += lineTotal(line)
    }
  }
  return acc
}

/** Orders bucketed by local hour of day (0..23) — customer density. */
export function hourlyDensity(orders) {
  const buckets = Array.from({ length: 24 }, () => 0)
  for (const o of orders) {
    if (!notCancelled(o)) continue
    buckets[new Date(o.createdAt).getHours()] += 1
  }
  return buckets
}

/**
 * One-shot analysis for the Analytics view: scopes to a range, then returns
 * headline figures, promotions, per-item (as-sold + exploded dish) tables and
 * the hourly density histogram.
 */
export function analyze(orders, { from, to, menu = [] } = {}) {
  const scoped = ordersInRange(orders, { from, to })
  // Analytics reflects *realized* sales: only completed orders count. Open
  // orders are still in progress (pending, not yet counted) and cancelled ones
  // are excluded — so closing an order is what registers it in analytics.
  const sales = scoped.filter((o) => o.status === 'completed')
  const nameOf = (id) => menu.find((m) => m.id === id)?.name ?? id

  const asSold = Object.values(itemsSold(sales))
    // Heal the display name for legacy/corrupted lines whose snapshot lost its
    // name (falls back to the menu, then to the raw id — never undefined).
    .map((row) => ({ ...row, name: row.name ?? nameOf(row.id) }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'))
  const explodedDishes = Object.entries(dishSoldCounts(sales))
    .map(([id, qty]) => ({ id, name: nameOf(id), qty }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'))

  return {
    totalRevenue: totalRevenue(sales),
    promotions: promotions(sales),
    orderStats: orderStats(sales),
    itemsAsSold: asSold,
    explodedDishes,
    hourlyDensity: hourlyDensity(sales),
  }
}
