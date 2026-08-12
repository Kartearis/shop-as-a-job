import { ref, watch } from 'vue'
import { get, set } from 'idb-keyval'

/**
 * A reactive ref persisted to IndexedDB (via idb-keyval). This is the app's
 * single source of truth across reloads — there is no backend.
 *
 * Hydration is asynchronous: the returned `ready` promise resolves once the
 * stored value has been loaded. Persistence only starts *after* hydration, so
 * the default value can never clobber stored data. Writes are debounced and
 * snapshotted (JSON round-trip) to store plain, non-reactive data.
 *
 * @returns {{ data: import('vue').Ref, ready: Promise<void>, flush: () => Promise<void> }}
 */
export function useIdbRef(key, defaultValue, { delay = 200 } = {}) {
  const data = ref(defaultValue)
  let timer = null

  async function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    try {
      // Snapshot to a plain, serialisable value — strips Vue proxies.
      await set(key, JSON.parse(JSON.stringify(data.value)))
    } catch (err) {
      console.error(`useIdbRef: failed to persist "${key}"`, err)
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, delay)
  }

  const ready = (async () => {
    try {
      const stored = await get(key)
      if (stored !== undefined) data.value = stored
    } catch (err) {
      // Corrupt/unreadable store: fall back to the default rather than crash.
      console.error(`useIdbRef: failed to load "${key}", using default`, err)
    }
    // Begin persisting only now, so hydration doesn't trigger a redundant write
    // and the default never overwrites what was stored.
    watch(data, schedule, { deep: true })
  })()

  return { data, ready, flush }
}
