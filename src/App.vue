<script setup>
import { ref } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import { useStore } from './composables/useStore.js'
import NewOrderView from './views/NewOrderView.vue'
import OrdersView from './views/OrdersView.vue'
import HistoryView from './views/HistoryView.vue'
import StockView from './views/StockView.vue'
import AnalyticsView from './views/AnalyticsView.vue'
import MenuView from './views/MenuView.vue'
import BackupControls from './components/BackupControls.vue'

const store = useStore()
const tab = ref('orders')

const tabs = [
  { value: 'new', label: 'Новый', icon: '＋' },
  { value: 'orders', label: 'Заказы', icon: '☰' },
  { value: 'history', label: 'История', icon: '⟲' },
  { value: 'stock', label: 'Продано', icon: '▤' },
  { value: 'analytics', label: 'Аналитика', icon: '▮' },
  { value: 'menu', label: 'Меню', icon: '≣' },
]
</script>

<template>
  <TabsRoot v-model="tab" class="app">
    <header class="app-bar">
      <strong>Кафе</strong>
      <BackupControls :store="store" />
    </header>

    <main class="app-main">
      <TabsContent value="new"><NewOrderView :store="store" @created="tab = 'orders'" /></TabsContent>
      <TabsContent value="orders"><OrdersView :store="store" /></TabsContent>
      <TabsContent value="history"><HistoryView :store="store" /></TabsContent>
      <TabsContent value="stock"><StockView :store="store" /></TabsContent>
      <TabsContent value="analytics"><AnalyticsView :store="store" /></TabsContent>
      <TabsContent value="menu"><MenuView :store="store" /></TabsContent>
    </main>

    <TabsList class="tab-bar" aria-label="Разделы">
      <TabsTrigger
        v-for="t in tabs"
        :key="t.value"
        :value="t.value"
        class="tab"
      >
        <span class="tab-icon">{{ t.icon }}</span>
        <span class="tab-label">{{ t.label }}</span>
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
