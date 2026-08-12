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
