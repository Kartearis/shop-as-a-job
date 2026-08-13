<script setup>
import { ref, computed } from 'vue'
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
import MenuItemForm from '../components/MenuItemForm.vue'
import { describeComponents } from '../lib/menu.js'
import { formatRub } from '../lib/money.js'

const props = defineProps({
  store: { type: Object, required: true },
})

const fileInput = ref(null)
const message = ref('')

// Add/edit form dialog.
const formOpen = ref(false)
const formItem = ref(null) // null = adding a new item

// Confirmation dialog for actions touching items used in active orders (edit or
// delete). `confirm` drives the dialog (title/message/label); the deferred
// action is held separately so the dialog's auto-close — which clears
// `confirm` — can't race the confirm handler and drop the action.
const confirm = ref(null) // { title, message, actionLabel, danger }
let confirmAction = null

// Human-readable "«name» used in N active orders (customers…)" preamble.
function usageNote(name, affected) {
  const who = affected.map((o) => o.customerName).join(', ')
  return `«${name}» используется в ${affected.length} активных заказах (${who}).`
}

const menu = computed(() => props.store.menu.value)

// Menu grouped by category, preserving first-seen order.
const groups = computed(() => {
  const byCat = new Map()
  for (const item of menu.value) {
    const cat = item.category ?? 'Прочее'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat).push(item)
  }
  return [...byCat.entries()].map(([name, items]) => ({ name, items }))
})

const partsOf = (components) => describeComponents(components, menu.value)

function openAdd() {
  formItem.value = null
  formOpen.value = true
}
function openEdit(item) {
  formItem.value = item
  formOpen.value = true
}

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
  // Only clears the dialog; leaves confirmAction so an Action click that also
  // triggers this (via update:open) can't null the action before runConfirm.
  confirm.value = null
}

function commit(payload) {
  props.store.upsertMenuItem(payload)
  formOpen.value = false
  formItem.value = null
}

function onFormSave(payload) {
  // Warn only when editing an item that is live in an open order.
  if (payload.id) {
    const affected = props.store.ordersUsingItem(payload.id)
    if (affected.length) {
      askConfirm(
        {
          title: 'Позиция в активных заказах',
          message: `${usageNote(payload.name, affected)} Уже добавленные позиции в этих заказах не изменятся — они хранят снимок на момент заказа. Сохранить правки в меню?`,
          actionLabel: 'Сохранить',
        },
        () => commit(payload),
      )
      return
    }
  }
  commit(payload)
}

function remove(item) {
  const affected = props.store.ordersUsingItem(item.id)
  if (affected.length) {
    askConfirm(
      {
        title: 'Позиция в активных заказах',
        message: `${usageNote(item.name, affected)} Позиция останется доступной в этих заказах и в истории — удаление лишь скроет её из меню. Удалить?`,
        actionLabel: 'Удалить',
        danger: true,
      },
      () => props.store.deleteMenuItem(item.id),
    )
    return
  }
  props.store.deleteMenuItem(item.id)
}
function restore(item) {
  props.store.restoreMenuItem(item.id)
}

// ---- JSON export / import ----
const today = () => new Date().toISOString().slice(0, 10)

async function exportMenu() {
  await props.store.flush()
  const blob = new Blob([props.store.exportMenu()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cafe-menu-${today()}.json`
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
    props.store.importMenu(await file.text())
    message.value = 'Меню загружено.'
  } catch (err) {
    message.value = `Ошибка импорта: ${err.message}`
  } finally {
    event.target.value = ''
  }
}
</script>

<template>
  <div class="view">
    <h2>Меню</h2>

    <div class="menu-toolbar">
      <button class="primary" @click="openAdd">＋ Добавить</button>
      <button class="ghost" @click="exportMenu">Экспорт JSON</button>
      <button class="ghost" @click="pickFile">Импорт JSON</button>
      <input
        ref="fileInput"
        type="file"
        accept="application/json"
        hidden
        @change="onFile"
      />
    </div>
    <p v-if="message" class="hint">{{ message }}</p>

    <section v-for="g in groups" :key="g.name">
      <h3>{{ g.name }}</h3>
      <ul class="menu-manage">
        <li
          v-for="item in g.items"
          :key="item.id"
          class="menu-manage-row"
          :class="{ removed: item.active === false }"
        >
          <div class="mm-info">
            <span class="mm-name">
              {{ item.name }}
              <em v-if="item.type === 'combo'" class="tag-combo">комбо</em>
              <em v-if="item.active === false" class="tag-removed">удалено</em>
            </span>
            <small v-if="item.type === 'combo'" class="combo-parts">
              {{ partsOf(item.components).map((c) => `${c.name} ×${c.quantity}`).join(' · ') }}
            </small>
          </div>
          <span class="mm-price">{{ formatRub(item.price) }}</span>
          <div class="mm-actions">
            <button class="ghost" @click="openEdit(item)">✎</button>
            <button
              v-if="item.active === false"
              class="ghost"
              title="Восстановить"
              @click="restore(item)"
            >
              ↺
            </button>
            <button
              v-else
              class="x"
              title="Удалить"
              aria-label="Удалить"
              @click="remove(item)"
            >
              ×
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Add / edit dialog -->
    <DialogRoot :open="formOpen" @update:open="(v) => !v && (formOpen = false)">
      <DialogPortal>
        <DialogOverlay class="dialog-overlay" />
        <DialogContent class="dialog-content">
          <DialogTitle class="dialog-title">
            {{ formItem ? 'Редактировать позицию' : 'Новая позиция' }}
          </DialogTitle>
          <MenuItemForm
            v-if="formOpen"
            :menu="menu"
            :item="formItem"
            :submit-label="formItem ? 'Сохранить изменения' : 'Добавить'"
            @save="onFormSave"
            @cancel="formOpen = false"
          />
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Warn before editing or deleting items used in active orders -->
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
