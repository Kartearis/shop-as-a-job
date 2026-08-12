import { describe, it, expect } from 'vitest'
import { elapsedMs, formatElapsed, formatClock, startOfDay } from '../src/lib/time.js'

describe('elapsedMs', () => {
  it('measures forward time', () => {
    const from = '2026-08-12T09:00:00'
    const now = new Date('2026-08-12T09:05:00').getTime()
    expect(elapsedMs(from, now)).toBe(5 * 60000)
  })

  it('clamps negative to zero', () => {
    const from = '2026-08-12T09:10:00'
    const now = new Date('2026-08-12T09:00:00').getTime()
    expect(elapsedMs(from, now)).toBe(0)
  })
})

describe('formatElapsed', () => {
  it('shows minutes under an hour', () => {
    expect(formatElapsed(5 * 60000)).toBe('5 мин')
    expect(formatElapsed(0)).toBe('0 мин')
    expect(formatElapsed(59 * 60000)).toBe('59 мин')
  })

  it('shows hours and minutes past an hour', () => {
    expect(formatElapsed(80 * 60000)).toBe('1 ч 20 мин')
    expect(formatElapsed(120 * 60000)).toBe('2 ч 0 мин')
  })

  it('floors partial minutes', () => {
    expect(formatElapsed(90 * 1000)).toBe('1 мин')
  })
})

describe('formatClock', () => {
  it('formats a local time as HH:MM', () => {
    // local-form ISO (no Z) is interpreted in the local zone
    expect(formatClock('2026-08-12T09:05:00')).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('startOfDay', () => {
  it('zeroes the time component', () => {
    const d = startOfDay(new Date('2026-08-12T15:34:21'))
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
  })
})
