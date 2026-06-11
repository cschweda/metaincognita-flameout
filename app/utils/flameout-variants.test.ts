import { describe, it, expect } from 'vitest'
import {
  pickGauntletItemType,
  rollGauntletItemValue,
  gauntletSpawnEV,
  makeGauntletItem,
  rollReels,
  calcSlotPayout,
  slotSpinEV,
  makeJackpotTrigger,
  ITEM_Y_SPREAD_FRAC
} from './flameout-variants'
import { GAUNTLET_ITEM_DEFS, SLOT_OUTCOMES } from '~/types/flameout'
import type { GauntletItemType } from '~/types/flameout'
import { mulberry32 } from './flameout-rng'

describe('gauntlet economy', () => {
  it('spawned-item EV is exactly zero (no money faucet)', () => {
    expect(gauntletSpawnEV()).toBe(0)
  })

  it('item weights sum to 100', () => {
    const total = Object.values(GAUNTLET_ITEM_DEFS).reduce((a, d) => a + d.weight, 0)
    expect(total).toBe(100)
  })

  it('picks item types proportionally to weight', () => {
    const random = mulberry32(42)
    const counts: Record<GauntletItemType, number> = { coin: 0, star: 0, diamond: 0, mine: 0, asteroid: 0 }
    const N = 50_000
    for (let i = 0; i < N; i++) counts[pickGauntletItemType(random)]++

    for (const [type, def] of Object.entries(GAUNTLET_ITEM_DEFS)) {
      const observed = counts[type as GauntletItemType] / N
      const expected = def.weight / 100
      expect(Math.abs(observed - expected)).toBeLessThan(0.01)
    }
  })

  it('rolls values within each item range with the correct sign', () => {
    const random = mulberry32(7)
    for (const [type, def] of Object.entries(GAUNTLET_ITEM_DEFS)) {
      for (let i = 0; i < 500; i++) {
        const v = rollGauntletItemValue(type as GauntletItemType, random)
        const lo = Math.min(def.minValue, def.maxValue)
        const hi = Math.max(def.minValue, def.maxValue)
        expect(v).toBeGreaterThanOrEqual(lo)
        expect(v).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('empirical EV of spawned items converges near zero', () => {
    const random = mulberry32(123)
    const N = 200_000
    let sum = 0
    for (let i = 0; i < N; i++) {
      sum += makeGauntletItem(i, 0, random).value
    }
    // Mean item value within ±$0.10 of zero over 200K spawns
    expect(Math.abs(sum / N)).toBeLessThan(10)
  })

  it('spawns items within the vertical band', () => {
    const random = mulberry32(99)
    for (let i = 0; i < 1000; i++) {
      const item = makeGauntletItem(i, 5000, random)
      expect(Math.abs(item.yOffsetFrac)).toBeLessThanOrEqual(ITEM_Y_SPREAD_FRAC)
      expect(item.timeMs).toBeGreaterThan(5000)
    }
  })
})

describe('jackpot slot machine', () => {
  it('spin EV equals the stake (net zero)', () => {
    expect(slotSpinEV(500)).toBe(500)
    expect(slotSpinEV(1000)).toBe(1000)
  })

  it('pays 10× stake for triple 7s, 5× for other triples, 2× for doubles, 0 otherwise', () => {
    expect(calcSlotPayout(['7', '7', '7'], 100)).toBe(1000)
    expect(calcSlotPayout(['star', 'star', 'star'], 100)).toBe(500)
    expect(calcSlotPayout(['bar', 'bar', 'cherry'], 100)).toBe(200)
    expect(calcSlotPayout(['bar', 'cherry', 'bar'], 100)).toBe(200)
    expect(calcSlotPayout(['cherry', 'bar', 'bar'], 100)).toBe(200)
    expect(calcSlotPayout(['7', 'cherry', 'star'], 100)).toBe(0)
  })

  it('reel outcome classes match the configured probabilities', () => {
    const random = mulberry32(2024)
    const N = 100_000
    let tripleSeven = 0
    let triple = 0
    let double = 0
    let none = 0

    for (let i = 0; i < N; i++) {
      const reels = rollReels(random)
      const isTriple = reels[0] === reels[1] && reels[1] === reels[2]
      if (isTriple && reels[0] === '7') tripleSeven++
      else if (isTriple) triple++
      else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) double++
      else none++
    }

    expect(Math.abs(tripleSeven / N - SLOT_OUTCOMES.tripleSeven.probability)).toBeLessThan(0.005)
    expect(Math.abs(triple / N - SLOT_OUTCOMES.triple.probability)).toBeLessThan(0.005)
    expect(Math.abs(double / N - SLOT_OUTCOMES.double.probability)).toBeLessThan(0.01)
    expect(Math.abs(none / N - 0.70)).toBeLessThan(0.01)
  })

  it('empirical net spin result converges to zero', () => {
    const random = mulberry32(555)
    const N = 200_000
    const stake = 300
    let net = 0
    for (let i = 0; i < N; i++) {
      net += calcSlotPayout(rollReels(random), stake) - stake
    }
    // Mean net within ±2% of the stake over 200K spins
    expect(Math.abs(net / N)).toBeLessThan(stake * 0.02)
  })

  it('trigger stakes grow with round progress', () => {
    const random = mulberry32(8)
    const early = makeJackpotTrigger(0, 0, random)
    const late = makeJackpotTrigger(1, 60_000, random)
    expect(early.stake).toBeGreaterThanOrEqual(200)
    expect(late.stake).toBeGreaterThan(early.stake)
  })
})
