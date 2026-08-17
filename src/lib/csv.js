// Flatten order history to a spreadsheet-friendly CSV. Pure, no I/O — the
// download (blob + BOM) happens in the UI layer. One row per line item, with
// order-level fields repeated; prices are rendered in rubles (2 decimals).

import { kopecksToRubles } from './money.js'
import { orderTotal, orderCharged, lineTotal, dailyOrderNumbers } from './orders.js'
import { describeComponents } from './menu.js'

const HEADERS = [
  'ID заказа',
  'Номер',
  'Дата',
  'Статус',
  'Клиент',
  'Бесплатно',
  'Доставка',
  'Адрес',
  'Комментарий',
  'ID позиции',
  'Позиция',
  'Тип',
  'Состав',
  'Цена (₽)',
  'Кол-во',
  'Сумма позиции (₽)',
  'Итого заказ (₽)',
  'К оплате (₽)',
]

const STATUS_RU = {
  open: 'Открыт',
  ready: 'Готов к доставке',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

/** Kopecks → ruble string with 2 decimals and a dot separator (CSV-safe). */
function rub(kopecks) {
  return kopecksToRubles(kopecks ?? 0).toFixed(2)
}

/** Quote a cell only when it contains a comma, quote or newline; double quotes. */
function escapeCell(value) {
  const s = String(value ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Human combo breakdown, e.g. "Капучино×1; Круассан×1"; empty for dishes. */
function comboText(line, menu) {
  if (line.type !== 'combo') return ''
  return describeComponents(line.components, menu)
    .map((c) => `${c.name}×${c.quantity}`)
    .join('; ')
}

/**
 * Build a CSV string for every order (all statuses), oldest first, one row per
 * line item. Orders with no line items still get a single summary row. Returns
 * the CSV body without a byte-order mark — add one at download time for Excel.
 */
export function ordersToCsv(orders, menu = []) {
  const rows = [HEADERS]
  const numbers = dailyOrderNumbers(orders)
  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  )

  for (const o of sorted) {
    const total = rub(orderTotal(o))
    const charged = rub(orderCharged(o))
    // Order-level fields, repeated on every line row. Fields added in later
    // versions (delivery/address/comment) fall back to empty for older data.
    const base = [
      o.id,
      numbers.get(o.id) ?? '',
      o.createdAt,
      STATUS_RU[o.status] ?? o.status ?? '',
      o.customerName,
      o.free ? 'да' : 'нет',
      o.delivery ? 'да' : 'нет',
      o.address ?? '',
      o.comment ?? '',
    ]

    if (!o.lineItems?.length) {
      rows.push([...base, '', '', '', '', '', '', '', total, charged])
      continue
    }
    for (const l of o.lineItems) {
      rows.push([
        ...base,
        l.itemId,
        l.name ?? l.itemId,
        l.type ?? '',
        comboText(l, menu),
        rub(l.unitPrice),
        l.quantity ?? 0,
        rub(lineTotal(l)),
        total,
        charged,
      ])
    }
  }

  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')
}
