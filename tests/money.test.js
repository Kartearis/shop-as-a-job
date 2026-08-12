import { describe, it, expect } from 'vitest'
import { formatRub, rublesToKopecks, kopecksToRubles } from '../src/lib/money.js'

// ICU emits non-breaking / narrow-no-break spaces that vary by build, so
// normalise whitespace out before asserting on the visible characters.
const strip = (s) => s.replace(/\s/gu, '')

describe('formatRub', () => {
  it('formats kopecks as ru-RU rubles with a comma decimal and ₽', () => {
    expect(strip(formatRub(123450))).toBe('1234,50₽')
  })

  it('formats zero', () => {
    expect(strip(formatRub(0))).toBe('0,00₽')
  })

  it('keeps two fraction digits for whole rubles', () => {
    expect(strip(formatRub(15000))).toBe('150,00₽')
  })

  it('handles sub-ruble amounts', () => {
    expect(strip(formatRub(5))).toBe('0,05₽')
  })
})

describe('rublesToKopecks', () => {
  it('multiplies by 100 and rounds', () => {
    expect(rublesToKopecks(150)).toBe(15000)
    expect(rublesToKopecks(1.999)).toBe(200)
    expect(rublesToKopecks(0.1)).toBe(10)
  })
})

describe('kopecksToRubles', () => {
  it('divides by 100', () => {
    expect(kopecksToRubles(15000)).toBe(150)
    expect(kopecksToRubles(5)).toBe(0.05)
  })
})
