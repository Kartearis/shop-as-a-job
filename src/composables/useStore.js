import { computed } from 'vue'
import { useIdbRef } from './useIdbRef.js'
import { SEED_MENU, validateMenu } from '../lib/menu.js'
import { ordersToCsv } from '../lib/csv.js'

// App-wide state: the code-seeded menu and the full order history, both
// persisted to IndexedDB. Stock and analytics are derived from `orders`
// elsewhere — this store only owns the raw data and mutations.

/** Create an independent store instance (used directly by tests). */
export function createStore() {
  const menuRef = useIdbRef('cafe.menu', [])
  const ordersRef = useIdbRef('cafe.orders', [])

  const ready = Promise.all([menuRef.ready, ordersRef.ready]).then(() => {
    // Seed the menu on first run only.
    if (menuRef.data.value.length === 0) {
      menuRef.data.value = JSON.parse(JSON.stringify(SEED_MENU))
    }
  })

  const menu = menuRef.data
  const orders = ordersRef.data

  const activeMenu = computed(() => menu.value.filter((i) => i.active !== false))
  const liveOrders = computed(() =>
    orders.value
      .filter((o) => o.status === 'open')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
  )
  // Finished orders for the history view, most recently completed first.
  const completedOrders = computed(() =>
    orders.value
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
  )

  const now = () => new Date().toISOString()

  /** Insert a new order or replace an existing one (matched by id). */
  function upsertOrder(order) {
    const stamped = { ...order, updatedAt: now() }
    const exists = orders.value.some((o) => o.id === order.id)
    orders.value = exists
      ? orders.value.map((o) => (o.id === order.id ? stamped : o))
      : [...orders.value, stamped]
  }

  function setStatus(id, status) {
    orders.value = orders.value.map((o) =>
      o.id === id ? { ...o, status, updatedAt: now() } : o,
    )
  }

  const completeOrder = (id) => setStatus(id, 'completed')
  const cancelOrder = (id) => setStatus(id, 'cancelled')

  function deleteOrder(id) {
    orders.value = orders.value.filter((o) => o.id !== id)
  }

  /** Serialise all data for backup/export. */
  function exportData() {
    return JSON.stringify(
      { version: 1, menu: menu.value, orders: orders.value },
      null,
      2,
    )
  }

  /** Flatten order history to a spreadsheet-friendly CSV string (no BOM). */
  function exportCsv() {
    return ordersToCsv(orders.value, menu.value)
  }

  /** Replace all data from a previously exported JSON string. Throws on bad input. */
  function importData(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json
    if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.menu)) {
      throw new Error('Invalid backup: expected { menu: [], orders: [] }')
    }
    const menuErrors = validateMenu(parsed.menu)
    if (menuErrors.length) {
      throw new Error(`Invalid menu in backup: ${menuErrors[0]}`)
    }
    menu.value = parsed.menu
    orders.value = parsed.orders
  }

  const flush = () => Promise.all([menuRef.flush(), ordersRef.flush()])

  return {
    menu,
    orders,
    activeMenu,
    liveOrders,
    completedOrders,
    ready,
    upsertOrder,
    completeOrder,
    cancelOrder,
    deleteOrder,
    exportData,
    exportCsv,
    importData,
    flush,
  }
}

let singleton = null

/** Shared singleton store for the running app. */
export function useStore() {
  return (singleton ??= createStore())
}
