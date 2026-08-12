import { describe, it, expect } from 'vitest'
import { SEED_MENU, validateMenu } from '../src/lib/menu.js'

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
