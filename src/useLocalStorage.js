import { ref, watch } from 'vue'

/**
 * A reactive ref that is persisted to localStorage. All app data lives here —
 * there is no backend, so this is the single source of truth across reloads.
 */
export function useLocalStorage(key, defaultValue) {
  const stored = localStorage.getItem(key)
  const data = ref(stored !== null ? JSON.parse(stored) : defaultValue)

  watch(
    data,
    (value) => {
      localStorage.setItem(key, JSON.stringify(value))
    },
    { deep: true },
  )

  return data
}
