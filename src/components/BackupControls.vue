<script setup>
import { ref } from 'vue'

const props = defineProps({
  store: { type: Object, required: true },
})

const fileInput = ref(null)
const message = ref('')

// UTF-8 byte-order mark so Excel detects the encoding and shows Cyrillic right.
const BOM = '﻿'

function download(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const today = () => new Date().toISOString().slice(0, 10)

async function exportJson() {
  await props.store.flush()
  download(`cafe-backup-${today()}.json`, props.store.exportData(), 'application/json')
}

async function exportCsv() {
  await props.store.flush()
  download(`cafe-orders-${today()}.csv`, BOM + props.store.exportCsv(), 'text/csv;charset=utf-8;')
}

function pickFile() {
  message.value = ''
  fileInput.value?.click()
}

async function onFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    props.store.importData(text)
    message.value = 'Данные загружены.'
  } catch (err) {
    message.value = `Ошибка импорта: ${err.message}`
  } finally {
    event.target.value = ''
  }
}
</script>

<template>
  <div class="backup">
    <button class="ghost" @click="exportJson">Экспорт JSON</button>
    <button class="ghost" @click="exportCsv">Экспорт CSV</button>
    <button class="ghost" @click="pickFile">Импорт</button>
    <input
      ref="fileInput"
      type="file"
      accept="application/json"
      hidden
      @change="onFile"
    />
    <span v-if="message" class="backup-msg">{{ message }}</span>
  </div>
</template>
