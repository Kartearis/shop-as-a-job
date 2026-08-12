import { describe, it, expect } from 'vitest'
import { dishSoldCounts, comboSoldCounts, stockReport } from '../src/lib/stock.js'
import { makeLineItem, createOrder } from '../src/lib/orders.js'

const coffee = { id: 'coffee', name: 'Капучино', type: 'dish', price: 20000 }
const croissant = { id: 'croissant', name: 'Круассан', type: 'dish', price: 12000 }
const juice = { id: 'juice', name: 'Сок', type: 'dish', price: 15000 }
const combo = {
  id: 'breakfast',
  name: 'Завтрак',
  type: 'combo',
  price: 28000,
  components: [
    { itemId: 'coffee', quantity: 1 },
    { itemId: 'croissant', quantity: 2 },
  ],
}
const menu = [coffee, croissant, juice, combo]

function order(lineItems, overrides = {}) {
  return { ...createOrder({ id: 'x' }), lineItems, ...overrides }
}

describe('dishSoldCounts', () => {
  it('counts plain dish quantities', () => {
    const orders = [order([makeLineItem(coffee, 2), makeLineItem(juice, 1)])]
    expect(dishSoldCounts(orders)).toEqual({ coffee: 2, juice: 1 })
  })

  it('explodes a combo into its components', () => {
    const orders = [order([makeLineItem(combo, 1)])]
    // combo has 1 coffee + 2 croissants
    expect(dishSoldCounts(orders)).toEqual({ coffee: 1, croissant: 2 })
  })

  it('multiplies component qty by combo line qty', () => {
    const orders = [order([makeLineItem(combo, 3)])]
    expect(dishSoldCounts(orders)).toEqual({ coffee: 3, croissant: 6 })
  })

  it('merges combo and standalone dish counts', () => {
    const orders = [order([makeLineItem(combo, 1), makeLineItem(coffee, 1)])]
    // 1 coffee from combo + 1 standalone = 2
    expect(dishSoldCounts(orders)).toEqual({ coffee: 2, croissant: 2 })
  })

  it('accumulates across multiple orders', () => {
    const orders = [
      order([makeLineItem(coffee, 1)]),
      order([makeLineItem(coffee, 2)]),
    ]
    expect(dishSoldCounts(orders)).toEqual({ coffee: 3 })
  })

  it('excludes cancelled orders', () => {
    const orders = [
      order([makeLineItem(coffee, 5)], { status: 'cancelled' }),
      order([makeLineItem(coffee, 1)]),
    ]
    expect(dishSoldCounts(orders)).toEqual({ coffee: 1 })
  })

  it('includes free/promotional orders', () => {
    const orders = [order([makeLineItem(coffee, 2)], { free: true })]
    expect(dishSoldCounts(orders)).toEqual({ coffee: 2 })
  })

  it('counts completed orders', () => {
    const orders = [order([makeLineItem(coffee, 1)], { status: 'completed' })]
    expect(dishSoldCounts(orders)).toEqual({ coffee: 1 })
  })
})

describe('comboSoldCounts', () => {
  it('counts combos as whole units, ignoring dishes', () => {
    const orders = [order([makeLineItem(combo, 2), makeLineItem(coffee, 1)])]
    expect(comboSoldCounts(orders)).toEqual({ breakfast: 2 })
  })

  it('excludes cancelled orders', () => {
    const orders = [order([makeLineItem(combo, 1)], { status: 'cancelled' })]
    expect(comboSoldCounts(orders)).toEqual({})
  })
})

describe('stockReport', () => {
  it('returns dish and combo rows sorted by qty desc with names resolved', () => {
    const orders = [
      order([makeLineItem(combo, 1), makeLineItem(juice, 3)]),
      order([makeLineItem(coffee, 1)]),
    ]
    const report = stockReport(orders, menu)
    // dishes: juice 3, croissant 2, coffee 2 (1 combo + 1 standalone)
    expect(report.dishes).toEqual([
      { id: 'juice', name: 'Сок', qty: 3 },
      { id: 'coffee', name: 'Капучино', qty: 2 },
      { id: 'croissant', name: 'Круассан', qty: 2 },
    ])
    expect(report.combos).toEqual([{ id: 'breakfast', name: 'Завтрак', qty: 1 }])
  })

  it('falls back to id when the menu lacks the item', () => {
    const orders = [order([makeLineItem(coffee, 1)])]
    const report = stockReport(orders, [])
    expect(report.dishes[0].name).toBe('coffee')
  })
})
