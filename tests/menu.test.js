import { describe, it, expect } from 'vitest'
import {
  SEED_MENU,
  validateMenu,
  slugify,
  makeMenuId,
  upsertMenuItem,
  setMenuItemActive,
  activeOrdersUsingItem,
} from '../src/lib/menu.js'

describe('SEED_MENU', () => {
  it('passes its own validation', () => {
    expect(validateMenu(SEED_MENU)).toEqual([])
  })

  it('contains both dishes and combos', () => {
    expect(SEED_MENU.some((i) => i.type === 'dish')).toBe(true)
    expect(SEED_MENU.some((i) => i.type === 'combo')).toBe(true)
  })

  it('prices everything in positive integer kopecks', () => {
    for (const item of SEED_MENU) {
      expect(Number.isInteger(item.price)).toBe(true)
      expect(item.price).toBeGreaterThan(0)
    }
  })
})

describe('validateMenu', () => {
  it('flags duplicate ids', () => {
    const menu = [
      { id: 'a', type: 'dish', price: 100 },
      { id: 'a', type: 'dish', price: 200 },
    ]
    expect(validateMenu(menu)).toContain('Duplicate id: a')
  })

  it('flags non-positive prices', () => {
    expect(validateMenu([{ id: 'a', type: 'dish', price: 0 }])).toContain(
      'Non-positive price: a',
    )
  })

  it('flags a combo referencing a missing item', () => {
    const menu = [
      {
        id: 'c',
        type: 'combo',
        price: 100,
        components: [{ itemId: 'ghost', quantity: 1 }],
      },
    ]
    expect(validateMenu(menu)).toContain('Combo c references missing item: ghost')
  })

  it('flags a combo referencing a non-dish', () => {
    const menu = [
      { id: 'c1', type: 'combo', price: 100, components: [{ itemId: 'x', quantity: 1 }] },
      { id: 'x', type: 'combo', price: 50, components: [{ itemId: 'c1', quantity: 1 }] },
    ]
    expect(validateMenu(menu)).toContain('Combo c1 references non-dish: x')
  })

  it('flags an empty combo', () => {
    expect(
      validateMenu([{ id: 'c', type: 'combo', price: 100, components: [] }]),
    ).toContain('Combo has no components: c')
  })

  it('flags non-positive component quantity', () => {
    const menu = [
      { id: 'd', type: 'dish', price: 100 },
      { id: 'c', type: 'combo', price: 100, components: [{ itemId: 'd', quantity: 0 }] },
    ]
    expect(validateMenu(menu)).toContain(
      'Combo c has non-positive component qty: d',
    )
  })
})

describe('slugify', () => {
  it('lowercases and underscores non-alphanumerics, keeping unicode letters', () => {
    expect(slugify('Раф Кокос')).toBe('раф_кокос')
    expect(slugify('Flat White 2.0')).toBe('flat_white_2_0')
  })

  it('never returns an empty string', () => {
    expect(slugify('')).toBe('item')
    expect(slugify('   ')).toBe('item')
    expect(slugify('!!!')).toBe('item')
  })
})

describe('makeMenuId', () => {
  it('derives an id from the name when free', () => {
    expect(makeMenuId('Раф', [])).toBe('раф')
  })

  it('suffixes on collision', () => {
    const menu = [{ id: 'раф' }, { id: 'раф_2' }]
    expect(makeMenuId('Раф', menu)).toBe('раф_3')
  })
})

describe('upsertMenuItem', () => {
  it('appends a new item and does not mutate the input', () => {
    const menu = [{ id: 'a', price: 100 }]
    const next = upsertMenuItem(menu, { id: 'b', price: 200 })
    expect(next).toHaveLength(2)
    expect(menu).toHaveLength(1)
  })

  it('replaces in place, preserving position', () => {
    const menu = [{ id: 'a', price: 100 }, { id: 'b', price: 200 }]
    const next = upsertMenuItem(menu, { id: 'a', price: 999 })
    expect(next.map((i) => i.id)).toEqual(['a', 'b'])
    expect(next[0].price).toBe(999)
  })
})

describe('setMenuItemActive', () => {
  it('toggles the active flag without mutating input', () => {
    const menu = [{ id: 'a', active: true }]
    const next = setMenuItemActive(menu, 'a', false)
    expect(next[0].active).toBe(false)
    expect(menu[0].active).toBe(true)
  })
})

describe('activeOrdersUsingItem', () => {
  const orders = [
    { id: 'o1', status: 'open', lineItems: [{ itemId: 'latte' }] },
    { id: 'o2', status: 'open', lineItems: [{ itemId: 'tea' }] },
    { id: 'o3', status: 'completed', lineItems: [{ itemId: 'latte' }] },
  ]

  it('returns only open orders that reference the item as a line', () => {
    expect(activeOrdersUsingItem(orders, 'latte').map((o) => o.id)).toEqual(['o1'])
  })

  it('returns empty when nothing matches', () => {
    expect(activeOrdersUsingItem(orders, 'ghost')).toEqual([])
    expect(activeOrdersUsingItem([], 'latte')).toEqual([])
  })
})
