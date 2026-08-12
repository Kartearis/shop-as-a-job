import { describe, it, expect } from 'vitest'
import {
  ordersInRange,
  totalRevenue,
  promotions,
  orderStats,
  itemsSold,
  hourlyDensity,
  analyze,
} from '../src/lib/analytics.js'
import { makeLineItem, createOrder } from '../src/lib/orders.js'

const coffee = { id: 'coffee', name: 'Капучино', type: 'dish', price: 20000 }
const croissant = { id: 'croissant', name: 'Круассан', type: 'dish', price: 12000 }
const combo = {
  id: 'breakfast',
  name: 'Завтрак',
  type: 'combo',
  price: 28000,
  components: [
    { itemId: 'coffee', quantity: 1 },
    { itemId: 'croissant', quantity: 1 },
  ],
}
const menu = [coffee, croissant, combo]

// createdAt uses a local-time form (no trailing Z) so getHours() is
// deterministic regardless of the machine timezone.
function order(lineItems, { createdAt = '2026-08-12T09:00:00', ...rest } = {}) {
  return { ...createOrder({ id: 'x', createdAt }), lineItems, ...rest }
}

describe('ordersInRange', () => {
  const a = order([], { createdAt: '2026-08-12T08:00:00' })
  const b = order([], { createdAt: '2026-08-12T12:00:00' })
  const c = order([], { createdAt: '2026-08-13T09:00:00' })

  it('keeps orders within [from, to)', () => {
    const inRange = ordersInRange([a, b, c], {
      from: '2026-08-12T00:00:00',
      to: '2026-08-13T00:00:00',
    })
    expect(inRange).toEqual([a, b])
  })

  it('is unbounded when from/to omitted', () => {
    expect(ordersInRange([a, b, c], {})).toHaveLength(3)
  })

  it('excludes the exact upper bound', () => {
    const inRange = ordersInRange([b], {
      from: '2026-08-12T00:00:00',
      to: '2026-08-12T12:00:00',
    })
    expect(inRange).toHaveLength(0)
  })
})

describe('totalRevenue', () => {
  it('sums charged amounts, excluding cancelled and free', () => {
    const orders = [
      order([makeLineItem(coffee, 1)]), // 20000
      order([makeLineItem(coffee, 1)], { free: true }), // 0
      order([makeLineItem(coffee, 5)], { status: 'cancelled' }), // excluded
    ]
    expect(totalRevenue(orders)).toBe(20000)
  })
})

describe('promotions', () => {
  it('counts free orders and nominal value given away', () => {
    const orders = [
      order([makeLineItem(combo, 1)], { free: true }), // nominal 28000
      order([makeLineItem(coffee, 1)], { free: true }), // nominal 20000
      order([makeLineItem(coffee, 1)]), // paid, ignored
      order([makeLineItem(coffee, 1)], { free: true, status: 'cancelled' }), // excluded
    ]
    expect(promotions(orders)).toEqual({ count: 2, valueGivenAway: 48000 })
  })
})

describe('orderStats', () => {
  it('computes AOV over paid orders only', () => {
    const orders = [
      order([makeLineItem(coffee, 1)]), // 20000
      order([makeLineItem(coffee, 2)]), // 40000
      order([makeLineItem(coffee, 9)], { free: true }), // excluded from AOV
    ]
    expect(orderStats(orders)).toEqual({
      paidOrders: 2,
      revenue: 60000,
      averageOrderValue: 30000,
    })
  })

  it('returns zero AOV with no paid orders', () => {
    expect(orderStats([]).averageOrderValue).toBe(0)
  })
})

describe('itemsSold', () => {
  it('counts qty for all, revenue only for paid lines', () => {
    const orders = [
      order([makeLineItem(coffee, 2)]), // paid
      order([makeLineItem(coffee, 1)], { free: true }), // free: qty yes, revenue no
    ]
    expect(itemsSold(orders).coffee).toEqual({
      id: 'coffee',
      name: 'Капучино',
      type: 'dish',
      qty: 3,
      revenue: 40000,
    })
  })

  it('treats a combo as its own line (not exploded)', () => {
    const orders = [order([makeLineItem(combo, 1)])]
    const sold = itemsSold(orders)
    expect(sold.breakfast).toMatchObject({ type: 'combo', qty: 1, revenue: 28000 })
    expect(sold.coffee).toBeUndefined()
  })
})

describe('hourlyDensity', () => {
  it('buckets orders by local hour of day', () => {
    const orders = [
      order([], { createdAt: '2026-08-12T09:15:00' }),
      order([], { createdAt: '2026-08-12T09:45:00' }),
      order([], { createdAt: '2026-08-12T14:00:00' }),
    ]
    const buckets = hourlyDensity(orders)
    expect(buckets).toHaveLength(24)
    expect(buckets[9]).toBe(2)
    expect(buckets[14]).toBe(1)
    expect(buckets[0]).toBe(0)
  })

  it('ignores cancelled orders', () => {
    const orders = [order([], { createdAt: '2026-08-12T09:00:00', status: 'cancelled' })]
    expect(hourlyDensity(orders)[9]).toBe(0)
  })
})

describe('analyze', () => {
  it('composes headline, promo, per-item and density from a scoped range', () => {
    const orders = [
      order([makeLineItem(combo, 1)], { createdAt: '2026-08-12T09:00:00' }), // paid 28000
      order([makeLineItem(coffee, 2)], { createdAt: '2026-08-12T10:00:00' }), // paid 40000
      order([makeLineItem(coffee, 1)], { createdAt: '2026-08-12T11:00:00', free: true }),
      order([makeLineItem(coffee, 1)], { createdAt: '2026-08-11T10:00:00' }), // out of range
    ]
    const result = analyze(orders, {
      from: '2026-08-12T00:00:00',
      to: '2026-08-13T00:00:00',
      menu,
    })

    expect(result.totalRevenue).toBe(68000)
    expect(result.promotions).toEqual({ count: 1, valueGivenAway: 20000 })
    expect(result.orderStats.paidOrders).toBe(2)
    // exploded dishes: coffee = 1(combo) + 2 + 1(free) = 4, croissant = 1
    const coffeeRow = result.explodedDishes.find((r) => r.id === 'coffee')
    expect(coffeeRow.qty).toBe(4)
    expect(result.hourlyDensity[9]).toBe(1)
    expect(result.hourlyDensity[10]).toBe(1)
    expect(result.hourlyDensity[11]).toBe(1)
  })

  it('does not crash on legacy lines missing name/price, and reports no NaN', () => {
    // Shape persisted by the old stepper bug: no name/type/unitPrice.
    const corrupt = order([{ itemId: 'coffee', quantity: 1 }], {
      createdAt: '2026-08-12T09:00:00',
    })
    const result = analyze([corrupt], {
      from: '2026-08-12T00:00:00',
      to: '2026-08-13T00:00:00',
      menu,
    })
    expect(Number.isNaN(result.totalRevenue)).toBe(false)
    expect(Number.isNaN(result.orderStats.averageOrderValue)).toBe(false)
    // Name is healed from the menu; revenue counts the unknown price as 0.
    expect(result.itemsAsSold[0]).toMatchObject({ name: 'Капучино', revenue: 0 })
  })
})
