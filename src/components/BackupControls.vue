<script setup>
import { ref } from 'vue'

const props = defineProps({
  store: { type: Object, required: true },
})

const fileInput = ref(null)
const message = ref('')

async function exportJson() {
  await props.store.flush()
  const blob = new Blob([props.store.exportData()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `cafe-backup-${stamp}.json`
  link.click()
  URL.revokeObjectURL(url)
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
    <button class="ghost" @click="pickFile">Импорт JSON</button>
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
