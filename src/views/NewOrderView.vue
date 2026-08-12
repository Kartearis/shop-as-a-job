<script setup>
import { ref } from 'vue'
import OrderForm from '../components/OrderForm.vue'
import { createOrder } from '../lib/orders.js'

const props = defineProps({
  store: { type: Object, required: true },
})
const emit = defineEmits(['created'])

const formKey = ref(0)

function onSave({ customerName, free, lineItems }) {
  const order = createOrder({ customerName, free })
  order.lineItems = lineItems
  props.store.upsertOrder(order)
  formKey.value++ // reset the form
  emit('created')
}

function onCancel() {
  formKey.value++
}
</script>

<template>
  <div class="view">
    <h2>Новый заказ</h2>
    <OrderForm
      :key="formKey"
      :menu="store.activeMenu.value"
      submit-label="Создать заказ"
      @save="onSave"
      @cancel="onCancel"
    />
  </div>
</template>
