import { describe, it, expect } from 'vitest'
import {
  makeLineItem,
  lineTotal,
  orderTotal,
  orderCharged,
  createOrder,
  addLine,
  setLineQuantity,
  updateLineQuantity,
  removeLine,
} from '../src/lib/orders.js'

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

describe('makeLineItem', () => {
  it('snapshots a dish', () => {
    const line = makeLineItem(coffee, 2)
    expect(line).toMatchObject({
      itemId: 'coffee',
      name: 'Капучино',
      type: 'dish',
      unitPrice: 20000,
      quantity: 2,
      lineTotal: 40000,
    })
    expect(line.components).toBeUndefined()
  })

  it('defaults quantity to 1', () => {
    expect(makeLineItem(coffee).quantity).toBe(1)
  })

  it('snapshots a combo with a frozen component breakdown', () => {
    const line = makeLineItem(combo, 1)
    expect(line.type).toBe('combo')
    expect(line.unitPrice).toBe(28000)
    expect(line.components).toEqual([
      { itemId: 'coffee', quantity: 1 },
      { itemId: 'croissant', quantity: 1 },
    ])
  })

  it('does not alias the source combo components', () => {
    const line = makeLineItem(combo, 1)
    line.components[0].quantity = 99
    expect(combo.components[0].quantity).toBe(1)
  })
})

describe('lineTotal', () => {
  it('is unitPrice * quantity', () => {
    expect(lineTotal({ unitPrice: 20000, quantity: 3 })).toBe(60000)
  })
})

describe('orderTotal / orderCharged', () => {
  const order = {
    free: false,
    lineItems: [makeLineItem(coffee, 2), makeLineItem(croissant, 1)],
  }

  it('sums nominal line totals', () => {
    expect(orderTotal(order)).toBe(52000)
  })

  it('charges the nominal total for a paid order', () => {
    expect(orderCharged(order)).toBe(52000)
  })

  it('charges 0 for a free order but keeps the nominal total', () => {
    const freeOrder = { ...order, free: true }
    expect(orderCharged(freeOrder)).toBe(0)
    expect(orderTotal(freeOrder)).toBe(52000)
  })
})

describe('createOrder', () => {
  it('creates an open order with echoed timestamps', () => {
    const order = createOrder({
      customerName: 'Аня',
      id: 'o1',
      createdAt: '2026-08-12T09:00:00.000Z',
    })
    expect(order).toEqual({
      id: 'o1',
      customerName: 'Аня',
      createdAt: '2026-08-12T09:00:00.000Z',
      updatedAt: '2026-08-12T09:00:00.000Z',
      status: 'open',
      free: false,
      lineItems: [],
    })
  })
})

describe('addLine', () => {
  it('appends a new item', () => {
    const lines = addLine([], coffee)
    expect(lines).toHaveLength(1)
    expect(lines[0].itemId).toBe('coffee')
  })

  it('increments quantity when the item already exists', () => {
    let lines = addLine([], coffee)
    lines = addLine(lines, coffee, 2)
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(3)
    expect(lines[0].lineTotal).toBe(60000)
  })

  it('does not mutate the input array', () => {
    const original = []
    addLine(original, coffee)
    expect(original).toHaveLength(0)
  })
})

describe('setLineQuantity', () => {
  it('sets an exact quantity', () => {
    let lines = addLine([], coffee, 5)
    lines = setLineQuantity(lines, coffee, 2)
    expect(lines[0].quantity).toBe(2)
    expect(lines[0].lineTotal).toBe(40000)
  })

  it('removes the line when quantity <= 0', () => {
    let lines = addLine([], coffee)
    lines = setLineQuantity(lines, coffee, 0)
    expect(lines).toHaveLength(0)
  })

  it('adds the line when it is not yet present', () => {
    const lines = setLineQuantity([], coffee, 3)
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(3)
  })
})

describe('updateLineQuantity', () => {
  it('changes quantity using the line snapshot, preserving name and price', () => {
    const lines = addLine([], coffee, 3)
    const next = updateLineQuantity(lines, 'coffee', 1)
    expect(next[0]).toMatchObject({
      itemId: 'coffee',
      name: 'Капучино',
      unitPrice: 20000,
      quantity: 1,
      lineTotal: 20000,
    })
  })

  it('keeps a combo component breakdown when changing quantity', () => {
    const lines = addLine([], combo, 2)
    const next = updateLineQuantity(lines, 'breakfast', 1)
    expect(next[0].components).toEqual([
      { itemId: 'coffee', quantity: 1 },
      { itemId: 'croissant', quantity: 1 },
    ])
  })

  it('removes the line when quantity drops to 0', () => {
    const lines = addLine([], coffee)
    expect(updateLineQuantity(lines, 'coffee', 0)).toHaveLength(0)
  })

  it('leaves unknown ids untouched', () => {
    const lines = addLine([], coffee)
    expect(updateLineQuantity(lines, 'nope', 5)).toEqual(lines)
  })

  it('does not mutate the input array', () => {
    const lines = addLine([], coffee, 2)
    updateLineQuantity(lines, 'coffee', 1)
    expect(lines[0].quantity).toBe(2)
  })
})

describe('removeLine', () => {
  it('removes by item id', () => {
    let lines = addLine(addLine([], coffee), croissant)
    lines = removeLine(lines, 'coffee')
    expect(lines).toHaveLength(1)
    expect(lines[0].itemId).toBe('croissant')
  })
})
