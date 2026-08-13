// Time formatting for the UI. Timestamps are stored as ISO strings and shown
// in the device's local timezone (Moscow for the target cafe).

/** Milliseconds elapsed between an ISO timestamp and `nowMs` (never negative). */
export function elapsedMs(fromIso, nowMs) {
  return Math.max(0, nowMs - new Date(fromIso).getTime())
}

/** Human elapsed duration in Russian, e.g. "5 мин" or "1 ч 20 мин". */
export function formatElapsed(ms) {
  const totalMin = Math.floor(Math.max(0, ms) / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`
}

/** Local wall-clock time, e.g. "09:05". */
export function formatClock(iso) {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Local date, e.g. "12.08.2026". */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU')
}

/** Local calendar-day key "YYYY-MM-DD" for grouping timestamps by day. */
export function dayKey(iso) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Start-of-day ISO (local) for a given Date — used for the analytics range. */
export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
