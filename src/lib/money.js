// Money is stored everywhere as integer kopecks (RUB * 100) to avoid
// floating-point drift. Formatting to a human "₽" string happens only here.

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format integer kopecks as a ru-RU currency string, e.g. 123450 -> "1 234,50 ₽". */
export function formatRub(kopecks) {
  return rubFormatter.format(kopecks / 100)
}

/** Convert a ruble amount (possibly fractional) to integer kopecks. */
export function rublesToKopecks(rubles) {
  return Math.round(rubles * 100)
}

/** Convert integer kopecks to a ruble number (for display/import only). */
export function kopecksToRubles(kopecks) {
  return kopecks / 100
}
