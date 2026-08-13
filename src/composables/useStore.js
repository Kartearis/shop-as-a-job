import { computed } from 'vue'
import { useIdbRef } from './useIdbRef.js'
import { dailyOrderNumbers } from '../lib/orders.js'
import {
  SEED_MENU,
  validateMenu,
  makeMenuId,
  upsertMenuItem as upsertMenuItemPure,
  setMenuItemActive,
  activeOrdersUsingItem,
} from '../lib/menu.js'
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
  // Active orders still in progress: 'open' (being prepared) and 'ready'
  // (delivery order out for delivery). Both live in the current-orders tab.
  const liveOrders = computed(() =>
    orders.value
      .filter((o) => o.status === 'open' || o.status === 'ready')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
  )
  // Finished orders for the history view, most recently completed first.
  const completedOrders = computed(() =>
    orders.value
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
  )

  // Per-day sequential order numbers (id -> number), resetting each local day.
  const orderNumbers = computed(() => dailyOrderNumbers(orders.value))

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
  // Delivery orders step through 'ready' (out for delivery) before completion.
  const markReady = (id) => setStatus(id, 'ready')

  function deleteOrder(id) {
    orders.value = orders.value.filter((o) => o.id !== id)
  }

  /**
   * Add a new menu item or update an existing one. An item without an id is
   * treated as new and gets a unique id derived from its name. Returns the
   * stored item (with its resolved id).
   */
  function upsertMenuItem(item) {
    const stored = item.id
      ? item
      : { ...item, id: makeMenuId(item.name, menu.value) }
    menu.value = upsertMenuItemPure(menu.value, stored)
    return stored
  }

  /** Soft-delete a menu item: hidden from ordering, kept for history/analytics. */
  function deleteMenuItem(id) {
    menu.value = setMenuItemActive(menu.value, id, false)
  }

  /** Restore a soft-deleted menu item. */
  function restoreMenuItem(id) {
    menu.value = setMenuItemActive(menu.value, id, true)
  }

  /** Open orders that use a menu item as a line — for the edit warning. */
  function ordersUsingItem(id) {
    return activeOrdersUsingItem(orders.value, id)
  }

  /** Serialise just the menu for export. */
  function exportMenu() {
    return JSON.stringify({ version: 1, menu: menu.value }, null, 2)
  }

  /** Replace the menu from an exported JSON string. Throws on bad input. */
  function importMenu(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json
    const nextMenu = Array.isArray(parsed) ? parsed : parsed.menu
    if (!Array.isArray(nextMenu)) {
      throw new Error('Invalid menu file: expected a menu array')
    }
    const errors = validateMenu(nextMenu)
    if (errors.length) {
      throw new Error(`Invalid menu: ${errors[0]}`)
    }
    menu.value = nextMenu
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
    orderNumbers,
    ready,
    upsertOrder,
    completeOrder,
    cancelOrder,
    markReady,
    deleteOrder,
    upsertMenuItem,
    deleteMenuItem,
    restoreMenuItem,
    ordersUsingItem,
    exportMenu,
    importMenu,
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
