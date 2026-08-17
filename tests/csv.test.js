import { describe, it, expect } from 'vitest'
import { ordersToCsv } from '../src/lib/csv.js'
import { makeLineItem, createOrder } from '../src/lib/orders.js'

const coffee = { id: 'coffee', name: 'Капучино', type: 'dish', price: 20000 }
const croissant = { id: 'croissant', name: 'Круассан', type: 'dish', price: 12000 }
const combo = {
  id: 'breakfast',
  name: 'Завтрак',
  type: 'combo',
  price: 28000,
  components: [
    { itemId: 'coffee', quantity: 1 },
    { itemId: 'croissant', quantity: 1 },
  ],
}
const menu = [coffee, croissant, combo]

function order(lineItems, extra = {}) {
  return { ...createOrder({ id: 'o', createdAt: '2026-08-12T09:00:00' }), lineItems, ...extra }
}

const lines = (csv) => csv.split('\r\n')

describe('ordersToCsv', () => {
  it('starts with a header row', () => {
    const csv = ordersToCsv([], menu)
    expect(lines(csv)[0]).toBe(
      'ID заказа,Номер,Дата,Статус,Клиент,Бесплатно,Доставка,Адрес,Комментарий,ID позиции,Позиция,Тип,Состав,Цена (₽),Кол-во,Сумма позиции (₽),Итого заказ (₽),К оплате (₽)',
    )
    expect(lines(csv)).toHaveLength(1) // header only when no orders
  })

  it('emits one row per line item with repeated order fields', () => {
    const o = order([makeLineItem(coffee, 2), makeLineItem(croissant, 1)], {
      id: 'o1',
      customerName: 'Аня',
      status: 'completed',
    })
    const rows = lines(ordersToCsv([o], menu))
    expect(rows).toHaveLength(3) // header + 2 items
    // id, daily number, date, status, customer, free, delivery, address, comment, then item cols
    expect(rows[1]).toContain('o1,1,2026-08-12T09:00:00,Завершён,Аня,нет,нет,,,coffee,Капучино,dish,')
    // price/qty/line-total for the coffee row: 200.00, 2, 400.00
    expect(rows[1]).toContain('200.00,2,400.00')
  })

  it('includes delivery, address, comment and localises the ready status', () => {
    const o = order([makeLineItem(coffee, 1)], {
      id: 'd1',
      customerName: 'Глеб',
      status: 'ready',
      delivery: true,
      address: 'Ленина 1',
      comment: 'без сахара',
    })
    const row = lines(ordersToCsv([o], menu))[1]
    expect(row).toContain('d1,1,2026-08-12T09:00:00,Готов к доставке,Глеб,нет,да,Ленина 1,без сахара,coffee,')
  })

  it('numbers orders per day (resetting each day)', () => {
    const a = order([makeLineItem(coffee, 1)], { id: 'a', createdAt: '2026-08-12T08:00:00', status: 'completed' })
    const b = order([makeLineItem(coffee, 1)], { id: 'b', createdAt: '2026-08-12T09:00:00', status: 'completed' })
    const c = order([makeLineItem(coffee, 1)], { id: 'c', createdAt: '2026-08-13T08:00:00', status: 'completed' })
    const rows = lines(ordersToCsv([a, b, c], menu))
    expect(rows[1].startsWith('a,1,')).toBe(true)
    expect(rows[2].startsWith('b,2,')).toBe(true)
    expect(rows[3].startsWith('c,1,')).toBe(true) // new day → resets
  })

  it('exports pre-update orders (no delivery/address/comment fields) safely', () => {
    // Shape persisted before delivery/comment existed.
    const legacy = {
      id: 'old',
      createdAt: '2026-08-12T09:00:00',
      updatedAt: '2026-08-12T09:00:00',
      status: 'completed',
      customerName: 'Старый',
      free: false,
      lineItems: [makeLineItem(coffee, 1)],
    }
    const row = lines(ordersToCsv([legacy], menu))[1]
    // delivery defaults to "нет", address/comment blank — no undefined leaks
    expect(row).toContain('old,1,2026-08-12T09:00:00,Завершён,Старый,нет,нет,,,coffee,')
    expect(row).not.toContain('undefined')
  })

  it('renders a combo breakdown in the Состав column', () => {
    const o = order([makeLineItem(combo, 1)], { status: 'completed' })
    const row = lines(ordersToCsv([o], menu))[1]
    expect(row).toContain('breakfast,Завтрак,combo,Капучино×1; Круассан×1')
  })

  it('marks free orders and shows 0.00 charged but the nominal total', () => {
    const o = order([makeLineItem(coffee, 1)], { free: true, status: 'completed' })
    const row = lines(ordersToCsv([o], menu))[1]
    // ...quantity 1, line 200.00, order total 200.00, charged 0.00
    expect(row.endsWith('200.00,1,200.00,200.00,0.00')).toBe(true)
    expect(row).toContain(',да,') // Бесплатно = да
  })

  it('quotes cells containing commas', () => {
    const o = order([makeLineItem(coffee, 1)], {
      customerName: 'Иванов, Пётр',
      status: 'completed',
    })
    expect(ordersToCsv([o], menu)).toContain('"Иванов, Пётр"')
  })

  it('sorts orders oldest-first', () => {
    const a = order([makeLineItem(coffee, 1)], { id: 'late', customerName: 'B', createdAt: '2026-08-12T18:00:00', status: 'completed' })
    const b = order([makeLineItem(coffee, 1)], { id: 'early', customerName: 'A', createdAt: '2026-08-12T08:00:00', status: 'completed' })
    const rows = lines(ordersToCsv([a, b], menu))
    expect(rows[1]).toContain('early')
    expect(rows[2]).toContain('late')
  })

  it('localises status and includes all statuses (open/cancelled too)', () => {
    const open = order([makeLineItem(coffee, 1)], { id: 'op', createdAt: '2026-08-12T08:00:00' })
    const cancelled = order([makeLineItem(coffee, 1)], { id: 'cx', createdAt: '2026-08-12T09:00:00', status: 'cancelled' })
    const rows = lines(ordersToCsv([open, cancelled], menu))
    expect(rows[1]).toContain(',Открыт,')
    expect(rows[2]).toContain(',Отменён,')
  })

  it('still emits a summary row for an order with no line items', () => {
    const empty = order([], { id: 'e', customerName: 'X', status: 'cancelled' })
    const rows = lines(ordersToCsv([empty], menu))
    expect(rows).toHaveLength(2)
    expect(rows[1].split(',')).toHaveLength(18) // all 18 columns present
    expect(rows[1].startsWith('e,1,2026-08-12T09:00:00,Отменён,X,нет,нет,,,')).toBe(true)
    expect(rows[1].endsWith(',0.00,0.00')).toBe(true)
  })
})
