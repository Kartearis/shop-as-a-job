<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from 'reka-ui'
import OrderForm from '../components/OrderForm.vue'
import { formatRub } from '../lib/money.js'
import { orderTotal } from '../lib/orders.js'
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

const numberOf = (id) => props.store.orderNumbers.value.get(id)

// Resolved combo breakdown for display; empty for plain dishes.
const partsOf = (components) =>
  describeComponents(components, props.store.activeMenu.value)

function onEditSave({ customerName, comment, free, lineItems, delivery, address }) {
  props.store.upsertOrder({
    ...editing.value,
    customerName,
    comment,
    free,
    delivery,
    address,
    lineItems,
  })
  editing.value = null
}

// Confirmation before finishing/cancelling an order. `confirm` drives the
// dialog; the deferred action is held separately so the dialog's auto-close
// (which clears `confirm`) can't race the handler and drop the action.
const confirm = ref(null) // { title, message, actionLabel, danger }
let confirmAction = null

function askConfirm(dialog, action) {
  confirm.value = dialog
  confirmAction = action
}
function runConfirm() {
  const action = confirmAction
  confirmAction = null
  confirm.value = null
  if (action) action()
}
function closeConfirm() {
  confirm.value = null
}

function markReady(o) {
  props.store.markReady(o.id)
}
function askComplete(o) {
  const delivered = o.delivery
  askConfirm(
    {
      title: delivered ? 'Заказ доставлен?' : 'Завершить заказ?',
      message: delivered
        ? `Заказ №${numberOf(o.id)} · ${o.customerName} будет отмечен как доставленный.`
        : `Заказ №${numberOf(o.id)} · ${o.customerName} будет отмечен как готовый.`,
      actionLabel: delivered ? 'Доставлен' : 'Готово',
    },
    () => props.store.completeOrder(o.id),
  )
}
function askCancel(o) {
  askConfirm(
    {
      title: 'Отменить заказ?',
      message: `Заказ №${numberOf(o.id)} · ${o.customerName} будет отменён.`,
      actionLabel: 'Отменить заказ',
      danger: true,
    },
    () => props.store.cancelOrder(o.id),
  )
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
          <span class="cust">
            <span class="order-no">№{{ numberOf(o.id) }}</span>
            {{ o.customerName }}
          </span>
          <span class="badge" :title="formatClock(o.createdAt)">
            {{ formatElapsed(elapsedMs(o.createdAt, now)) }}
          </span>
        </div>
        <p v-if="o.delivery" class="order-delivery">
          <span class="delivery-tag">Доставка</span>
          <span v-if="o.status === 'ready'" class="ready-tag">В доставке</span>
          <span class="delivery-address">{{ o.address }}</span>
        </p>
        <p v-if="o.comment" class="order-comment">
          <span class="comment-hint">Комментарий:</span> {{ o.comment }}
        </p>
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
          <button class="danger" @click="askCancel(o)">Отменить</button>
          <button
            v-if="o.delivery && o.status === 'open'"
            class="primary"
            @click="markReady(o)"
          >
            Готов к доставке
          </button>
          <button v-else class="primary" @click="askComplete(o)">
            {{ o.delivery ? 'Доставлен' : 'Готово' }}
          </button>
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

    <!-- Confirm before finishing/cancelling an order -->
    <AlertDialogRoot :open="!!confirm" @update:open="(v) => !v && closeConfirm()">
      <AlertDialogPortal>
        <AlertDialogOverlay class="dialog-overlay" />
        <AlertDialogContent class="alert-content">
          <AlertDialogTitle class="dialog-title">{{ confirm?.title }}</AlertDialogTitle>
          <AlertDialogDescription class="alert-desc">
            {{ confirm?.message }}
          </AlertDialogDescription>
          <div class="actions">
            <AlertDialogCancel class="ghost">Отмена</AlertDialogCancel>
            <AlertDialogAction
              :class="confirm?.danger ? 'danger' : 'primary'"
              @click="runConfirm"
            >
              {{ confirm?.actionLabel }}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </div>
</template>
