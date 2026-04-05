import { describe, it, expect } from 'vitest'
import { mulberry32, createRng } from './flameout-rng'

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 10000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic with same seed', () => {
    const rng1 = mulberry32(12345)
    const rng2 = mulberry32(12345)
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('produces different sequences for different seeds', () => {
    const rng1 = mulberry32(1)
    const rng2 = mulberry32(2)
    let same = 0
    for (let i = 0; i < 100; i++) {
      if (rng1() === rng2()) same++
    }
    expect(same).toBeLessThan(5)
  })

  it('has reasonable distribution (chi-squared rough check)', () => {
    const rng = mulberry32(42)
    const buckets = new Array(10).fill(0)
    const n = 100000
    for (let i = 0; i < n; i++) {
      const bucket = Math.floor(rng() * 10)
      buckets[bucket]++
    }
    const expected = n / 10
    for (const count of buckets) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05)
    }
  })
})

describe('createRng', () => {
  it('returns seeded RNG when seed provided', () => {
    const rng = createRng(42)
    const v1 = rng()
    const rng2 = createRng(42)
    expect(rng2()).toBe(v1)
  })

  it('returns Math.random when no seed', () => {
    const rng = createRng()
    expect(rng).toBe(Math.random)
  })
})
