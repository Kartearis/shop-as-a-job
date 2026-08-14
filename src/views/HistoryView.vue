<script setup>
import { ref } from 'vue'
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from 'reka-ui'
import { describeComponents } from '../lib/menu.js'
import { elapsedMs, formatElapsed, formatClock, formatDate } from '../lib/time.js'

const props = defineProps({
  store: { type: Object, required: true },
})

const numberOf = (id) => props.store.orderNumbers.value.get(id)

// Confirmation before wiping all order data.
const confirmReset = ref(false)
function resetHistory() {
  confirmReset.value = false
  props.store.clearOrders()
}

// Combo component names (no quantities/prices) for a compact inline breakdown.
const partsOf = (components) =>
  describeComponents(components, props.store.activeMenu.value)
    .map((c) => c.name)
    .join(', ')

// Local created date+time, e.g. "12.08.2026 09:05".
const createdAt = (o) => `${formatDate(o.createdAt)} ${formatClock(o.createdAt)}`

// Time from creation to completion (updatedAt is the completion timestamp).
const timeSpent = (o) =>
  formatElapsed(elapsedMs(o.createdAt, new Date(o.updatedAt).getTime()))
</script>

<template>
  <div class="view">
    <h2>История заказов</h2>

    <p v-if="!store.completedOrders.value.length" class="hint">
      Нет завершённых заказов.
    </p>

    <ul v-else class="history">
      <li v-for="o in store.completedOrders.value" :key="o.id" class="hist-row">
        <span class="hist-cust">
          <span class="order-no">№{{ numberOf(o.id) }}</span>
          {{ o.customerName }}
          <span v-if="o.delivery" class="delivery-tag">Доставка</span>
        </span>
        <span class="hist-meta">
          {{ createdAt(o) }} · выполнен за {{ timeSpent(o) }}
        </span>
        <span v-if="o.comment" class="hist-comment">
          <span class="comment-hint">Комментарий:</span> {{ o.comment }}
        </span>
        <span class="hist-items">
          <span v-for="(l, i) in o.lineItems" :key="l.itemId">
            {{ l.name }} ×{{ l.quantity
            }}<small v-if="l.type === 'combo'" class="hist-combo">
              &nbsp;({{ partsOf(l.components) }})</small
            ><span v-if="i < o.lineItems.length - 1"> · </span>
          </span>
        </span>
      </li>
    </ul>

    <div v-if="store.orders.value.length" class="history-reset">
      <button class="danger" @click="confirmReset = true">
        Очистить историю заказов
      </button>
    </div>

    <!-- Confirm before wiping all orders (history, stock, analytics) -->
    <AlertDialogRoot v-model:open="confirmReset">
      <AlertDialogPortal>
        <AlertDialogOverlay class="dialog-overlay" />
        <AlertDialogContent class="alert-content">
          <AlertDialogTitle class="dialog-title">Очистить историю?</AlertDialogTitle>
          <AlertDialogDescription class="alert-desc">
            Все заказы будут удалены безвозвратно, включая активные. История,
            продажи и аналитика станут пустыми. Меню не затрагивается.
          </AlertDialogDescription>
          <div class="actions">
            <AlertDialogCancel class="ghost">Отмена</AlertDialogCancel>
            <AlertDialogAction class="danger" @click="resetHistory">
              Очистить всё
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </div>
</template>
