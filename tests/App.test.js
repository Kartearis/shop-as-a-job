import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { clear } from 'idb-keyval'
import App from '../src/App.vue'

beforeEach(async () => {
  await clear()
})

async function clickTab(wrapper, label) {
  // reka-ui Tabs activate on mousedown/focus, not a synthetic click.
  const tab = wrapper.findAll('.tab').find((t) => t.text().includes(label))
  await tab.trigger('mousedown')
  await flushPromises()
}

describe('App', () => {
  it('renders the shell with the orders tab by default', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.text()).toContain('Текущие заказы')
  })

  it('renders every view without error when switching tabs', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()

    await clickTab(wrapper, 'Новый')
    expect(wrapper.text()).toContain('Новый заказ')
    // menu was seeded, so items are pickable
    expect(wrapper.findAll('.menu-item').length).toBeGreaterThan(0)

    await clickTab(wrapper, 'Продано')
    expect(wrapper.text()).toContain('Продано')

    await clickTab(wrapper, 'Аналитика')
    expect(wrapper.text()).toContain('Аналитика')
    expect(wrapper.find('.density').exists()).toBe(true)
  })

  it('lists a completed order in the История tab with items but no prices', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()

    // Create an order.
    await clickTab(wrapper, 'Новый')
    await wrapper.get('.order-form input').setValue('Борис')
    const item = wrapper.findAll('.menu-item').find((b) => b.text().includes('Капучино'))
    await item.trigger('click')
    await wrapper.get('.primary').trigger('click')
    await flushPromises()

    // Not in history yet (still open).
    await clickTab(wrapper, 'История')
    expect(wrapper.text()).toContain('Нет завершённых заказов')

    // Complete it (confirm the dialog), then it appears in history.
    await clickTab(wrapper, 'Заказы')
    await wrapper.get('.order-card .primary').trigger('click') // Готово
    await flushPromises()
    // The confirmation dialog is teleported to <body>; confirm it.
    const confirmBtn = [...document.querySelectorAll('.alert-content .actions button')].find(
      (b) => b.textContent.includes('Готово'),
    )
    confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    await clickTab(wrapper, 'История')
    const row = wrapper.get('.hist-row')
    expect(row.get('.hist-cust').text()).toContain('Борис')
    expect(row.get('.order-no').text()).toBe('№1') // daily sequence number
    expect(row.get('.hist-items').text()).toContain('Капучино ×1')
    expect(row.text()).not.toContain('₽') // no prices in history
  })

  it('creates an order end-to-end and shows it in the live list', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()

    await clickTab(wrapper, 'Новый')
    await wrapper.get('.order-form input').setValue('Аня')
    const item = wrapper.findAll('.menu-item').find((b) => b.text().includes('Капучино'))
    await item.trigger('click')
    await wrapper.get('.primary').trigger('click')
    await flushPromises()

    // NewOrderView emits 'created' -> app switches to orders tab
    expect(wrapper.text()).toContain('Текущие заказы')
    expect(wrapper.text()).toContain('Аня')
  })
})
