import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { get, set, clear } from 'idb-keyval'
import { useIdbRef } from '../src/composables/useIdbRef.js'

const tick = (ms) => new Promise((r) => setTimeout(r, ms))

beforeEach(async () => {
  await clear()
})

describe('useIdbRef', () => {
  it('hydrates the default when nothing is stored', async () => {
    const { data, ready } = useIdbRef('orders', [])
    await ready
    expect(data.value).toEqual([])
  })

  it('hydrates a previously stored value', async () => {
    await set('orders', [{ id: 'o1' }])
    const { data, ready } = useIdbRef('orders', [])
    await ready
    expect(data.value).toEqual([{ id: 'o1' }])
  })

  it('does not clobber stored data with the default before hydration', async () => {
    await set('menu', [{ id: 'coffee' }])
    const { data, ready } = useIdbRef('menu', [{ id: 'DEFAULT' }])
    await ready
    expect(data.value).toEqual([{ id: 'coffee' }])
  })

  it('flush() persists the current value immediately', async () => {
    const { data, ready, flush } = useIdbRef('orders', [])
    await ready
    data.value = [{ id: 'x', total: 100 }]
    await flush()
    expect(await get('orders')).toEqual([{ id: 'x', total: 100 }])
  })

  it('persists deep changes automatically after the debounce', async () => {
    const { data, ready } = useIdbRef('orders', [{ id: 'x', qty: 1 }], { delay: 5 })
    await ready
    data.value[0].qty = 3
    await nextTick()
    await tick(20)
    expect(await get('orders')).toEqual([{ id: 'x', qty: 3 }])
  })

  it('stores a plain snapshot, not a Vue proxy', async () => {
    const { data, ready, flush } = useIdbRef('orders', [])
    await ready
    data.value = [{ id: 'x', nested: { a: 1 } }]
    await flush()
    const stored = await get('orders')
    // A structured-clone-safe plain object round-trips deep-equal.
    expect(stored).toEqual([{ id: 'x', nested: { a: 1 } }])
  })

  it('two refs on different keys stay independent', async () => {
    const a = useIdbRef('menu', ['m'])
    const b = useIdbRef('orders', ['o'])
    await Promise.all([a.ready, b.ready])
    a.data.value = ['menu-changed']
    await a.flush()
    expect(await get('menu')).toEqual(['menu-changed'])
    expect(await get('orders')).toBeUndefined()
  })
})
