<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'reka-ui'
import OrderForm from '../components/OrderForm.vue'
import { formatRub } from '../lib/money.js'
import { orderTotal, orderCharged } from '../lib/orders.js'
import { describeComponents } from '../lib/menu.js'
import { elapsedMs, formatElapsed, formatClock } from '../lib/time.js'

const props = defineProps({
  store: { type: Object, required: true },
})

// A ticking clock so elapsed timers update once a minute without per-row timers.
const now = ref(Date.now())
let timer
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 30000)
})
onUnmounted(() => clearInterval(timer))

const editing = ref(null)

// Resolved combo breakdown for display; empty for plain dishes.
const partsOf = (components) =>
  describeComponents(components, props.store.activeMenu.value)

function onEditSave({ customerName, free, lineItems }) {
  props.store.upsertOrder({
    ...editing.value,
    customerName,
    free,
    lineItems,
  })
  editing.value = null
}
</script>

<template>
  <div class="view">
    <h2>Текущие заказы</h2>

    <p v-if="!store.liveOrders.value.length" class="hint">
      Нет активных заказов.
    </p>

    <ul class="orders">
      <li v-for="o in store.liveOrders.value" :key="o.id" class="order-card">
        <div class="order-head">
          <span class="cust">{{ o.customerName }}</span>
          <span class="badge" :title="formatClock(o.createdAt)">
            {{ formatElapsed(elapsedMs(o.createdAt, now)) }}
          </span>
        </div>
        <ul class="order-lines">
          <li v-for="l in o.lineItems" :key="l.itemId">
            <span>
              {{ l.name }} ×{{ l.quantity }}
              <small v-if="l.type === 'combo'" class="combo-parts">
                {{ partsOf(l.components).map((c) => `${c.name} ×${c.quantity}`).join(' · ') }}
              </small>
            </span>
            <span>{{ formatRub(l.lineTotal) }}</span>
          </li>
        </ul>
        <div class="order-foot">
          <span :class="{ struck: o.free }">{{ formatRub(orderTotal(o)) }}</span>
          <span v-if="o.free" class="promo-tag">ПРОМО · {{ formatRub(0) }}</span>
        </div>
        <div class="order-actions">
          <button class="ghost" @click="editing = o">Изменить</button>
          <button class="danger" @click="store.cancelOrder(o.id)">Отменить</button>
          <button class="primary" @click="store.completeOrder(o.id)">Готово</button>
        </div>
      </li>
    </ul>

    <DialogRoot :open="!!editing" @update:open="(v) => !v && (editing = null)">
      <DialogPortal>
        <DialogOverlay class="dialog-overlay" />
        <DialogContent class="dialog-content">
          <DialogTitle class="dialog-title">
            Заказ · {{ editing?.customerName }}
          </DialogTitle>
          <OrderForm
            v-if="editing"
            :menu="store.activeMenu.value"
            :order="editing"
            submit-label="Сохранить изменения"
            @save="onEditSave"
            @cancel="editing = null"
          />
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
