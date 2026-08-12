<script setup>
import { computed } from 'vue'
import { stockReport } from '../lib/stock.js'

const props = defineProps({
  store: { type: Object, required: true },
})

const report = computed(() =>
  stockReport(props.store.orders.value, props.store.menu.value),
)
</script>

<template>
  <div class="view">
    <h2>Продано</h2>
    <p class="hint">Всего продано за всё время (комбо разложены на позиции).</p>

    <h3>Позиции</h3>
    <ul class="stock-list">
      <li v-for="row in report.dishes" :key="row.id">
        <span>{{ row.name }}</span>
        <span class="count">{{ row.qty }}</span>
      </li>
      <li v-if="!report.dishes.length" class="hint">Пока ничего не продано.</li>
    </ul>

    <template v-if="report.combos.length">
      <h3>Комбо (целиком)</h3>
      <ul class="stock-list">
        <li v-for="row in report.combos" :key="row.id">
          <span>{{ row.name }}</span>
          <span class="count">{{ row.qty }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>
