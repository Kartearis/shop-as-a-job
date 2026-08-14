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

  it('exposes completed orders as completedOrders, newest completion first', async () => {
    const store = createStore()
    await store.ready
    // Set state directly with explicit updatedAt so ordering is deterministic.
    store.orders.value = [
      { ...openOrder('a'), status: 'completed', updatedAt: '2026-08-12T12:00:00' },
      { ...openOrder('b'), status: 'completed', updatedAt: '2026-08-12T12:05:00' },
      { ...openOrder('c'), status: 'open', updatedAt: '2026-08-12T12:10:00' },
      { ...openOrder('d'), status: 'cancelled', updatedAt: '2026-08-12T12:15:00' },
    ]

    // Only completed orders, most recently completed first; open/cancelled excluded.
    expect(store.completedOrders.value.map((o) => o.id)).toEqual(['b', 'a'])
  })

  it('markReady moves an order to ready and it stays in liveOrders', async () => {
    const store = createStore()
    await store.ready
    store.upsertOrder({ ...openOrder('d1'), delivery: true, address: 'Ленина, 1' })
    store.markReady('d1')
    expect(store.orders.value[0].status).toBe('ready')
    // 'ready' delivery orders are still active until completed.
    expect(store.liveOrders.value.map((o) => o.id)).toEqual(['d1'])
    store.completeOrder('d1')
    expect(store.liveOrders.value).toHaveLength(0)
    expect(store.completedOrders.value.map((o) => o.id)).toEqual(['d1'])
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

  it('clearOrders wipes all orders but leaves the menu intact', async () => {
    const store = createStore()
    await store.ready
    store.upsertOrder(openOrder('o1', [makeLineItem(coffee, 1)]))
    store.upsertOrder(openOrder('o2'))
    store.completeOrder('o2')
    const menuLen = store.menu.value.length

    store.clearOrders()
    expect(store.orders.value).toHaveLength(0)
    expect(store.liveOrders.value).toHaveLength(0)
    expect(store.completedOrders.value).toHaveLength(0)
    expect(store.menu.value).toHaveLength(menuLen)
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

describe('menu editing', () => {
  it('adds a new item with a generated id derived from its name', async () => {
    const store = createStore()
    await store.ready
    const before = store.menu.value.length
    const stored = store.upsertMenuItem({
      name: 'Раф',
      type: 'dish',
      price: 25000,
      category: 'Кофе',
      active: true,
    })
    expect(stored.id).toBe('раф')
    expect(store.menu.value).toHaveLength(before + 1)
  })

  it('updates an existing item in place', async () => {
    const store = createStore()
    await store.ready
    store.upsertMenuItem({ id: 'latte', name: 'Латте', type: 'dish', price: 30000, active: true })
    expect(store.menu.value.find((i) => i.id === 'latte').price).toBe(30000)
    expect(store.menu.value.filter((i) => i.id === 'latte')).toHaveLength(1)
  })

  it('soft-deletes and restores, keeping the item in the menu', async () => {
    const store = createStore()
    await store.ready
    store.deleteMenuItem('latte')
    expect(store.menu.value.find((i) => i.id === 'latte').active).toBe(false)
    expect(store.activeMenu.value.some((i) => i.id === 'latte')).toBe(false)

    store.restoreMenuItem('latte')
    expect(store.activeMenu.value.some((i) => i.id === 'latte')).toBe(true)
  })

  it('reports open orders that use an item', async () => {
    const store = createStore()
    await store.ready
    store.upsertOrder(openOrder('o1', [makeLineItem(coffee, 1)]))
    expect(store.ordersUsingItem('cappuccino').map((o) => o.id)).toEqual(['o1'])
    expect(store.ordersUsingItem('espresso')).toEqual([])
  })

  it('exports and re-imports the menu round-trip', async () => {
    const store = createStore()
    await store.ready
    store.deleteMenuItem('latte')
    const dump = store.exportMenu()

    const fresh = createStore()
    await fresh.ready
    fresh.importMenu(dump)
    expect(fresh.menu.value.find((i) => i.id === 'latte').active).toBe(false)
  })

  it('rejects an invalid menu import', async () => {
    const store = createStore()
    await store.ready
    expect(() => store.importMenu('{"foo":1}')).toThrow()
    expect(() =>
      store.importMenu(JSON.stringify({ menu: [{ id: 'x', type: 'dish', price: 0 }] })),
    ).toThrow()
  })
})
