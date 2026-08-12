import { describe, it, expect, beforeEach } from 'vitest'
import { clear } from 'idb-keyval'
import { createStore } from '../src/composables/useStore.js'
import { createOrder, makeLineItem } from '../src/lib/orders.js'
import { SEED_MENU } from '../src/lib/menu.js'

const coffee = { id: 'cappuccino', name: 'Капучино', type: 'dish', price: 22000 }

beforeEach(async () => {
  await clear()
})

function openOrder(id, lines = []) {
  return { ...createOrder({ id, customerName: 'Аня' }), lineItems: lines }
}

describe('createStore', () => {
  it('seeds the menu on first run', async () => {
    const store = createStore()
    await store.ready
    expect(store.menu.value).toHaveLength(SEED_MENU.length)
  })

  it('does not reseed when a menu is already stored', async () => {
    const a = createStore()
    await a.ready
    a.menu.value = [coffee]
    await a.flush()

    const b = createStore()
    await b.ready
    expect(b.menu.value).toEqual([coffee])
  })

  it('upserts a new order then updates it in place', async () => {
    const store = createStore()
    await store.ready

    store.upsertOrder(openOrder('o1', [makeLineItem(coffee, 1)]))
    expect(store.orders.value).toHaveLength(1)

    store.upsertOrder(openOrder('o1', [makeLineItem(coffee, 3)]))
    expect(store.orders.value).toHaveLength(1)
    expect(store.orders.value[0].lineItems[0].quantity).toBe(3)
  })

  it('exposes only open orders as liveOrders, oldest first', async () => {
    const store = createStore()
    await store.ready
    store.upsertOrder({
      ...openOrder('new'),
      createdAt: '2026-08-12T10:00:00',
    })
    store.upsertOrder({
      ...openOrder('old'),
      createdAt: '2026-08-12T08:00:00',
    })
    store.completeOrder('new')

    expect(store.liveOrders.value.map((o) => o.id)).toEqual(['old'])
  })

  it('completeOrder and cancelOrder change status', async () => {
    const store = createStore()
    await store.ready
    store.upsertOrder(openOrder('o1'))
    store.completeOrder('o1')
    expect(store.orders.value[0].status).toBe('completed')
    store.cancelOrder('o1')
    expect(store.orders.value[0].status).toBe('cancelled')
  })

  it('deleteOrder removes an order', async () => {
    const store = createStore()
    await store.ready
    store.upsertOrder(openOrder('o1'))
    store.deleteOrder('o1')
    expect(store.orders.value).toHaveLength(0)
  })

  it('exports and re-imports data round-trip', async () => {
    const store = createStore()
    await store.ready
    store.upsertOrder(openOrder('o1', [makeLineItem(coffee, 2)]))
    const dump = store.exportData()

    const fresh = createStore()
    await fresh.ready
    fresh.importData(dump)
    expect(fresh.orders.value).toHaveLength(1)
    expect(fresh.orders.value[0].id).toBe('o1')
  })

  it('rejects an invalid import', async () => {
    const store = createStore()
    await store.ready
    expect(() => store.importData('{"foo":1}')).toThrow()
  })
})
