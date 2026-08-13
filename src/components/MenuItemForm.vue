<script setup>
import { ref, computed } from 'vue'
import { describeComponents } from '../lib/menu.js'
import { formatRub, rublesToKopecks, kopecksToRubles } from '../lib/money.js'

const props = defineProps({
  // Full menu, used to offer dishes as combo components.
  menu: { type: Array, required: true },
  // Existing item to edit, or null to add a new one.
  item: { type: Object, default: null },
  submitLabel: { type: String, default: 'Сохранить' },
})
const emit = defineEmits(['save', 'cancel'])

const name = ref(props.item?.name ?? '')
const category = ref(props.item?.category ?? '')
const type = ref(props.item?.type ?? 'dish')
// Price is edited in rubles; stored as integer kopecks.
const priceRub = ref(
  props.item ? String(kopecksToRubles(props.item.price)) : '',
)
const components = ref(
  (props.item?.components ?? []).map((c) => ({ ...c })),
)

// Dishes that can be added as combo components (active only; an already-picked
// or now-inactive dish still renders via its frozen component row).
const addableDishes = computed(() =>
  props.menu.filter(
    (i) =>
      i.type === 'dish' &&
      i.active !== false &&
      i.id !== props.item?.id &&
      !components.value.some((c) => c.itemId === i.id),
  ),
)

const priceKopecks = computed(() => rublesToKopecks(Number(priceRub.value)))

// Sum of the components' current à la carte prices, for a savings hint.
const componentsSum = computed(() => {
  const byId = new Map(props.menu.map((m) => [m.id, m]))
  return components.value.reduce(
    (s, c) => s + (byId.get(c.itemId)?.price ?? 0) * c.quantity,
    0,
  )
})

const componentRows = computed(() =>
  describeComponents(components.value, props.menu),
)

const existingCategories = computed(() => [
  ...new Set(props.menu.map((i) => i.category).filter(Boolean)),
])

const canSave = computed(() => {
  if (!name.value.trim()) return false
  if (!(priceKopecks.value > 0)) return false
  if (type.value === 'combo' && components.value.length === 0) return false
  return true
})

function addComponent(dish) {
  const existing = components.value.find((c) => c.itemId === dish.id)
  if (existing) existing.quantity += 1
  else components.value.push({ itemId: dish.id, quantity: 1 })
}
function incComponent(itemId) {
  const c = components.value.find((c) => c.itemId === itemId)
  if (c) c.quantity += 1
}
function decComponent(itemId) {
  const c = components.value.find((c) => c.itemId === itemId)
  if (!c) return
  if (c.quantity <= 1) removeComponent(itemId)
  else c.quantity -= 1
}
function removeComponent(itemId) {
  components.value = components.value.filter((c) => c.itemId !== itemId)
}

function save() {
  if (!canSave.value) return
  const payload = {
    name: name.value.trim(),
    category: category.value.trim() || 'Прочее',
    type: type.value,
    price: priceKopecks.value,
    active: props.item?.active ?? true,
  }
  if (props.item?.id) payload.id = props.item.id
  if (type.value === 'combo') {
    payload.components = components.value.map((c) => ({
      itemId: c.itemId,
      quantity: c.quantity,
    }))
  }
  emit('save', payload)
}
</script>

<template>
  <div class="menu-form">
    <label class="field">
      <span>Название</span>
      <input v-model="name" placeholder="Например, Раф" />
    </label>

    <label class="field">
      <span>Категория</span>
      <input v-model="category" list="menu-categories" placeholder="Например, Кофе" />
      <datalist id="menu-categories">
        <option v-for="c in existingCategories" :key="c" :value="c" />
      </datalist>
    </label>

    <div class="field">
      <span>Тип</span>
      <div class="type-toggle">
        <button
          type="button"
          class="type-btn"
          :class="{ active: type === 'dish' }"
          @click="type = 'dish'"
        >
          Блюдо
        </button>
        <button
          type="button"
          class="type-btn"
          :class="{ active: type === 'combo' }"
          @click="type = 'combo'"
        >
          Комбо
        </button>
      </div>
    </div>

    <label class="field">
      <span>Цена, ₽</span>
      <input
        v-model="priceRub"
        type="number"
        inputmode="decimal"
        min="0"
        step="0.01"
        placeholder="0"
      />
    </label>

    <template v-if="type === 'combo'">
      <div class="field">
        <span>Состав комбо</span>
        <p v-if="!components.length" class="hint">Добавьте блюда из списка ниже.</p>
        <div v-else class="cart">
          <div v-for="row in componentRows" :key="row.itemId" class="cart-row">
            <span class="cart-name">{{ row.name }}</span>
            <div class="stepper">
              <button type="button" @click="decComponent(row.itemId)">−</button>
              <span class="qty">{{ row.quantity }}</span>
              <button type="button" @click="incComponent(row.itemId)">+</button>
            </div>
            <button
              class="x"
              type="button"
              aria-label="Убрать"
              @click="removeComponent(row.itemId)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <p v-if="components.length" class="hint savings">
        Отдельно: {{ formatRub(componentsSum) }}
        <span v-if="priceKopecks > 0 && componentsSum > priceKopecks" class="charged">
          · выгода {{ formatRub(componentsSum - priceKopecks) }}
        </span>
      </p>

      <div v-if="addableDishes.length" class="menu">
        <button
          v-for="dish in addableDishes"
          :key="dish.id"
          type="button"
          class="menu-item"
          @click="addComponent(dish)"
        >
          <span class="mi-name">{{ dish.name }}</span>
          <span class="mi-price">{{ formatRub(dish.price) }}</span>
        </button>
      </div>
    </template>

    <div class="actions">
      <button class="ghost" type="button" @click="emit('cancel')">Отмена</button>
      <button class="primary" type="button" :disabled="!canSave" @click="save">
        {{ submitLabel }}
      </button>
    </div>
  </div>
</template>
