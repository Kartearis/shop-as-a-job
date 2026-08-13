<script setup>
import { describeComponents } from '../lib/menu.js'
import { elapsedMs, formatElapsed, formatClock, formatDate } from '../lib/time.js'

const props = defineProps({
  store: { type: Object, required: true },
})

const numberOf = (id) => props.store.orderNumbers.value.get(id)

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
  </div>
</template>
