<script setup>
import { ref, computed } from 'vue'
import {
  CheckboxRoot,
  CheckboxIndicator,
  Separator,
} from 'reka-ui'
import { useLocalStorage } from './useLocalStorage.js'

// Persisted app state — survives reloads and works fully offline.
const items = useLocalStorage('shop.items', [])
const draft = ref('')

const remaining = computed(() => items.value.filter((i) => !i.done).length)

function addItem() {
  const text = draft.value.trim()
  if (!text) return
  items.value.unshift({ id: crypto.randomUUID(), text, done: false })
  draft.value = ''
}

function removeItem(id) {
  items.value = items.value.filter((i) => i.id !== id)
}

function clearDone() {
  items.value = items.value.filter((i) => !i.done)
}
</script>

<template>
  <main class="app">
    <header>
      <h1>Shopping list</h1>
      <p class="sub">{{ remaining }} item{{ remaining === 1 ? '' : 's' }} left</p>
    </header>

    <form class="add" @submit.prevent="addItem">
      <input
        v-model="draft"
        placeholder="Add an item…"
        aria-label="New item"
      />
      <button type="submit">Add</button>
    </form>

    <Separator class="sep" />

    <ul class="list">
      <li v-for="item in items" :key="item.id" :class="{ done: item.done }">
        <CheckboxRoot v-model="item.done" class="checkbox">
          <CheckboxIndicator class="indicator">✓</CheckboxIndicator>
        </CheckboxRoot>
        <span class="text">{{ item.text }}</span>
        <button class="remove" aria-label="Remove" @click="removeItem(item.id)">
          ×
        </button>
      </li>
      <li v-if="!items.length" class="empty">Nothing here yet.</li>
    </ul>

    <footer v-if="items.some((i) => i.done)">
      <button class="clear" @click="clearDone">Clear completed</button>
    </footer>
  </main>
</template>
