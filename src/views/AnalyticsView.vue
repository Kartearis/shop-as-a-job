<script setup>
import { ref, computed } from 'vue'
import { analyze } from '../lib/analytics.js'
import { formatRub } from '../lib/money.js'

const props = defineProps({
  store: { type: Object, required: true },
})

function todayLocal() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const dateStr = ref(todayLocal())
const allTime = ref(false)

const range = computed(() => {
  if (allTime.value) return {}
  const from = new Date(`${dateStr.value}T00:00:00`)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { from, to }
})

const a = computed(() =>
  analyze(props.store.orders.value, {
    ...range.value,
    menu: props.store.menu.value,
  }),
)

const maxHour = computed(() => Math.max(1, ...a.value.hourlyDensity))

// Zero-padded hour-of-day, e.g. 9 -> "09:00", so axis reads as clock time.
const hourLabel = (hour) => `${String(hour).padStart(2, '0')}:00`
</script>

<template>
  <div class="view">
    <h2>Аналитика</h2>

    <div class="range">
      <input v-model="dateStr" type="date" :disabled="allTime" />
      <label class="checkbox-row">
        <input v-model="allTime" type="checkbox" />
        За всё время
      </label>
    </div>

    <div class="kpis">
      <div class="kpi">
        <span class="kpi-label">Выручка</span>
        <strong>{{ formatRub(a.totalRevenue) }}</strong>
      </div>
      <div class="kpi">
        <span class="kpi-label">Заказов (платных)</span>
        <strong>{{ a.orderStats.paidOrders }}</strong>
      </div>
      <div class="kpi">
        <span class="kpi-label">Средний чек</span>
        <strong>{{ formatRub(a.orderStats.averageOrderValue) }}</strong>
      </div>
      <div class="kpi">
        <span class="kpi-label">Промо</span>
        <strong>{{ a.promotions.count }}</strong>
        <span class="kpi-sub">−{{ formatRub(a.promotions.valueGivenAway) }}</span>
      </div>
    </div>

    <h3>Плотность клиентов по часам</h3>
    <div class="density">
      <div
        v-for="(count, hour) in a.hourlyDensity"
        :key="hour"
        class="density-col"
      >
        <div class="bar-wrap">
          <div
            class="bar"
            :style="{ height: `${(count / maxHour) * 100}%` }"
            :title="`${hourLabel(hour)} — ${count}`"
          />
        </div>
        <span class="hour-label">{{ hour % 3 === 0 ? hourLabel(hour) : '' }}</span>
      </div>
    </div>

    <h3>Позиции (как продано)</h3>
    <ul class="stat-list">
      <li v-for="row in a.itemsAsSold" :key="row.id">
        <span>{{ row.name }}<em v-if="row.type === 'combo'"> · комбо</em></span>
        <span class="count">×{{ row.qty }}</span>
        <span class="rev">{{ formatRub(row.revenue) }}</span>
      </li>
      <li v-if="!a.itemsAsSold.length" class="hint">Нет данных за период.</li>
    </ul>
  </div>
</template>
