import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderForm from '../src/components/OrderForm.vue'

const menu = [
  { id: 'coffee', name: 'Капучино', type: 'dish', price: 22000, category: 'Кофе' },
  {
    id: 'combo',
    name: 'Завтрак',
    type: 'combo',
    price: 32000,
    category: 'Комбо',
    components: [{ itemId: 'coffee', quantity: 1 }],
  },
]

function firstMenuButton(wrapper, name) {
  return wrapper.findAll('.menu-item').find((b) => b.text().includes(name))
}

describe('OrderForm', () => {
  it('disables save until there is a name and at least one item', async () => {
    const wrapper = mount(OrderForm, { props: { menu } })
    const save = wrapper.get('.primary')
    expect(save.attributes('disabled')).toBeDefined()

    await wrapper.get('input').setValue('Аня')
    expect(wrapper.get('.primary').attributes('disabled')).toBeDefined()

    await firstMenuButton(wrapper, 'Капучино').trigger('click')
    expect(wrapper.get('.primary').attributes('disabled')).toBeUndefined()
  })

  it('accumulates quantity and reflects it in the cart', async () => {
    const wrapper = mount(OrderForm, { props: { menu } })
    await firstMenuButton(wrapper, 'Капучино').trigger('click')
    await firstMenuButton(wrapper, 'Капучино').trigger('click')

    const cartRow = wrapper.get('.cart-row')
    expect(cartRow.get('.qty').text()).toBe('2')
  })

  it('emits a save payload with trimmed name and line items', async () => {
    const wrapper = mount(OrderForm, { props: { menu } })
    await wrapper.get('input').setValue('  Аня  ')
    await firstMenuButton(wrapper, 'Завтрак').trigger('click')
    await wrapper.get('.primary').trigger('click')

    const saved = wrapper.emitted('save')
    expect(saved).toHaveLength(1)
    const payload = saved[0][0]
    expect(payload.customerName).toBe('Аня')
    expect(payload.free).toBe(false)
    expect(payload.lineItems).toHaveLength(1)
    expect(payload.lineItems[0]).toMatchObject({ itemId: 'combo', type: 'combo' })
  })

  it('pre-fills from an existing order when editing', () => {
    const order = {
      customerName: 'Борис',
      free: true,
      lineItems: [
        { itemId: 'coffee', name: 'Капучино', type: 'dish', unitPrice: 22000, quantity: 2, lineTotal: 44000 },
      ],
    }
    const wrapper = mount(OrderForm, { props: { menu, order } })
    expect(wrapper.get('input').element.value).toBe('Борис')
    expect(wrapper.get('.cart-row .qty').text()).toBe('2')
  })

  it('decrementing quantity keeps the line name and price intact', async () => {
    const wrapper = mount(OrderForm, { props: { menu } })
    await firstMenuButton(wrapper, 'Капучино').trigger('click')
    await firstMenuButton(wrapper, 'Капучино').trigger('click')

    const cartRow = wrapper.get('.cart-row')
    const [minus] = cartRow.findAll('.stepper button')
    await minus.trigger('click')

    expect(cartRow.get('.qty').text()).toBe('1')
    expect(cartRow.get('.cart-name').text()).toContain('Капучино')
    // Regression: price must stay a real amount, not NaN/undefined.
    const total = cartRow.get('.cart-total').text()
    expect(total).toContain('220')
    expect(total).not.toContain('NaN')
  })

  it('shows a combo breakdown in the cart', async () => {
    const wrapper = mount(OrderForm, { props: { menu } })
    await firstMenuButton(wrapper, 'Завтрак').trigger('click')
    expect(wrapper.get('.cart-row .combo-parts').text()).toContain('Капучино ×1')
  })

  it('emits cancel', async () => {
    const wrapper = mount(OrderForm, { props: { menu } })
    await wrapper.get('.ghost').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
