<script setup>
import { ref, computed } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { addLine, setLineQuantity, removeLine, lineTotal } from '../lib/orders.js'
import { formatRub } from '../lib/money.js'

const props = defineProps({
  menu: { type: Array, required: true },
  // Existing order to edit, or null for a new order.
  order: { type: Object, default: null },
  submitLabel: { type: String, default: 'Сохранить' },
})
const emit = defineEmits(['save', 'cancel'])

const customerName = ref(props.order?.customerName ?? '')
const free = ref(props.order?.free ?? false)
const lines = ref(props.order ? [...props.order.lineItems] : [])
const search = ref('')

// Menu grouped by category, filtered by the search box.
const groups = computed(() => {
  const q = search.value.trim().toLowerCase()
  const byCat = new Map()
  for (const item of props.menu) {
    if (q && !item.name.toLowerCase().includes(q)) continue
    const cat = item.category ?? 'Прочее'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat).push(item)
  }
  return [...byCat.entries()].map(([name, items]) => ({ name, items }))
})

const qtyOf = (id) => lines.value.find((l) => l.itemId === id)?.quantity ?? 0
const total = computed(() => lines.value.reduce((s, l) => s + lineTotal(l), 0))
const charged = computed(() => (free.value ? 0 : total.value))

const canSave = computed(
  () => customerName.value.trim().length > 0 && lines.value.length > 0,
)

function add(item) {
  lines.value = addLine(lines.value, item, 1)
}
function dec(item) {
  lines.value = setLineQuantity(lines.value, item, qtyOf(item.id) - 1)
}
function remove(itemId) {
  lines.value = removeLine(lines.value, itemId)
}

function save() {
  if (!canSave.value) return
  emit('save', {
    customerName: customerName.value.trim(),
    free: free.value,
    lineItems: lines.value,
  })
}
</script>

<template>
  <div class="order-form">
    <label class="field">
      <span>Имя клиента</span>
      <input v-model="customerName" placeholder="Например, Аня" />
    </label>

    <label class="switch-row">
      <SwitchRoot v-model="free" class="switch">
        <SwitchThumb class="switch-thumb" />
      </SwitchRoot>
      <span>Бесплатно (промо)</span>
    </label>

    <div v-if="lines.length" class="cart">
      <div v-for="l in lines" :key="l.itemId" class="cart-row">
        <span class="cart-name">{{ l.name }}</span>
        <div class="stepper">
          <button type="button" @click="dec({ id: l.itemId })">−</button>
          <span class="qty">{{ l.quantity }}</span>
          <button
            type="button"
            @click="add(menu.find((m) => m.id === l.itemId))"
          >
            +
          </button>
        </div>
        <span class="cart-total">{{ formatRub(l.lineTotal) }}</span>
        <button class="x" type="button" aria-label="Убрать" @click="remove(l.itemId)">
          ×
        </button>
      </div>
    </div>
    <p v-else class="hint">Добавьте позиции из меню ниже.</p>

    <div class="totals">
      <span>Итого</span>
      <span :class="{ struck: free }">{{ formatRub(total) }}</span>
      <strong v-if="free" class="charged">К оплате {{ formatRub(0) }}</strong>
    </div>

    <input v-model="search" class="menu-search" placeholder="Поиск по меню…" />

    <div class="menu">
      <section v-for="g in groups" :key="g.name">
        <h3>{{ g.name }}</h3>
        <button
          v-for="item in g.items"
          :key="item.id"
          type="button"
          class="menu-item"
          :class="{ picked: qtyOf(item.id) > 0 }"
          @click="add(item)"
        >
          <span class="mi-name">
            {{ item.name }}
            <em v-if="item.type === 'combo'">комбо</em>
          </span>
          <span class="mi-price">{{ formatRub(item.price) }}</span>
          <span v-if="qtyOf(item.id) > 0" class="mi-qty">×{{ qtyOf(item.id) }}</span>
        </button>
      </section>
    </div>

    <div class="actions">
      <button class="ghost" type="button" @click="emit('cancel')">Отмена</button>
      <button class="primary" type="button" :disabled="!canSave" @click="save">
        {{ submitLabel }}
      </button>
    </div>
  </div>
</template>
