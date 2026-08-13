<script setup>
import { describeComponents } from '../lib/menu.js'

const props = defineProps({
  store: { type: Object, required: true },
})

// Combo component names (no quantities/prices) for a compact inline breakdown.
const partsOf = (components) =>
  describeComponents(components, props.store.activeMenu.value)
    .map((c) => c.name)
    .join(', ')
</script>

<template>
  <div class="view">
    <h2>История заказов</h2>

    <p v-if="!store.completedOrders.value.length" class="hint">
      Нет завершённых заказов.
    </p>

    <ul v-else class="history">
      <li v-for="o in store.completedOrders.value" :key="o.id" class="hist-row">
        <span class="hist-cust">{{ o.customerName }}</span>
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
