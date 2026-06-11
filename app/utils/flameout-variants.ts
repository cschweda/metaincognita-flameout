/**
 * Pure game logic for the Gauntlet and Jackpot variants.
 *
 * Everything here is deterministic given a RandomFn, so the side-game
 * economics are unit-testable — the canvas component only renders and
 * detects collisions.
 */

import { GAUNTLET_ITEM_DEFS, SLOT_SYMBOLS, SLOT_OUTCOMES } from '~/types/flameout'
import type { GauntletItem, GauntletItemType, JackpotTrigger, SlotSymbol } from '~/types/flameout'
import type { RandomFn } from './flameout-rng'

// ── Gauntlet ────────────────────────────────────────────────────────────────

export const GAUNTLET_SPAWN_BASE_MS = 1400
export const JACKPOT_SPAWN_BASE_MS = 2200

/** Vertical spawn band, as a fraction of canvas height around the curve. */
export const ITEM_Y_SPREAD_FRAC = 0.38

export function pickGauntletItemType(random: RandomFn = Math.random): GauntletItemType {
  const types = Object.entries(GAUNTLET_ITEM_DEFS)
  const totalWeight = types.reduce((a, [, d]) => a + d.weight, 0)
  let roll = random() * totalWeight
  for (const [t, def] of types) {
    roll -= def.weight
    if (roll <= 0) return t as GauntletItemType
  }
  return 'coin'
}

/** Uniform value within the item's range (sign carried by the def). */
export function rollGauntletItemValue(type: GauntletItemType, random: RandomFn = Math.random): number {
  const def = GAUNTLET_ITEM_DEFS[type]
  const absMin = Math.min(Math.abs(def.minValue), Math.abs(def.maxValue))
  const absMax = Math.max(Math.abs(def.minValue), Math.abs(def.maxValue))
  const absVal = Math.round(random() * (absMax - absMin) + absMin)
  return def.minValue < 0 ? -absVal : absVal
}

/**
 * Analytic EV of one spawned item, in cents: Σ weight × midpoint / Σ weight.
 * The item table is balanced so this is exactly 0.
 */
export function gauntletSpawnEV(): number {
  const defs = Object.values(GAUNTLET_ITEM_DEFS)
  const totalWeight = defs.reduce((a, d) => a + d.weight, 0)
  const weighted = defs.reduce((a, d) => a + d.weight * ((d.minValue + d.maxValue) / 2), 0)
  return weighted / totalWeight
}

export function makeGauntletItem(id: number, currentMs: number, random: RandomFn = Math.random): GauntletItem {
  const type = pickGauntletItemType(random)
  return {
    id,
    type,
    timeMs: currentMs + 2500 + random() * 2000,
    yOffsetFrac: (random() - 0.5) * 2 * ITEM_Y_SPREAD_FRAC,
    value: rollGauntletItemValue(type, random),
    collected: false,
    missed: false,
    radius: type === 'diamond' ? 14 : type === 'star' ? 13 : 11
  }
}

/** Spawn interval shrinks as the round progresses (more pressure later). */
export function gauntletSpawnInterval(currentMs: number): number {
  return GAUNTLET_SPAWN_BASE_MS - Math.min(currentMs / 20, 400)
}

// ── Jackpot ─────────────────────────────────────────────────────────────────

export function jackpotSpawnInterval(currentMs: number): number {
  return JACKPOT_SPAWN_BASE_MS - Math.min(currentMs / 25, 500)
}

export function makeJackpotTrigger(id: number, currentMs: number, random: RandomFn = Math.random): JackpotTrigger {
  // Stakes grow with round progress — later spins risk (and pay) more
  const progressBonus = Math.floor(currentMs / 2000) * 50
  const stake = 200 + Math.floor(random() * 300) + progressBonus // $2.00+
  return {
    id,
    timeMs: currentMs + 2800 + random() * 2000,
    yOffsetFrac: (random() - 0.5) * 2 * (ITEM_Y_SPREAD_FRAC - 0.04),
    stake,
    collected: false,
    missed: false,
    radius: 16
  }
}

/**
 * Roll the three reels by outcome class, per SLOT_OUTCOMES:
 * 2% triple 7s, 8% other triple, 20% double, 70% no match.
 */
export function rollReels(random: RandomFn = Math.random): [SlotSymbol, SlotSymbol, SlotSymbol] {
  const pick = (): SlotSymbol => SLOT_SYMBOLS[Math.floor(random() * SLOT_SYMBOLS.length)]!
  const pickNonSeven = (): SlotSymbol => {
    const others = SLOT_SYMBOLS.filter(s => s !== '7')
    return others[Math.floor(random() * others.length)]!
  }

  const roll = random()

  if (roll < SLOT_OUTCOMES.tripleSeven.probability) {
    return ['7', '7', '7']
  }

  if (roll < SLOT_OUTCOMES.tripleSeven.probability + SLOT_OUTCOMES.triple.probability) {
    const s = pickNonSeven()
    return [s, s, s]
  }

  const doubleCutoff = SLOT_OUTCOMES.tripleSeven.probability
    + SLOT_OUTCOMES.triple.probability
    + SLOT_OUTCOMES.double.probability
  if (roll < doubleCutoff) {
    const s = pick()
    let other = pick()
    while (other === s) other = pick()
    const arrangements: [SlotSymbol, SlotSymbol, SlotSymbol][] = [
      [s, s, other],
      [s, other, s],
      [other, s, s]
    ]
    return arrangements[Math.floor(random() * 3)]!
  }

  // No match — three distinct symbols
  const r1 = pick()
  let r2 = pick()
  while (r2 === r1) r2 = pick()
  let r3 = pick()
  while (r3 === r1 || r3 === r2) r3 = pick()
  return [r1, r2, r3]
}

/** Gross payout for a spin: 10×/5×/2× the stake, or nothing. */
export function calcSlotPayout(reels: [SlotSymbol, SlotSymbol, SlotSymbol], stake: number): number {
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    const multiple = reels[0] === '7'
      ? SLOT_OUTCOMES.tripleSeven.payoutMultiple
      : SLOT_OUTCOMES.triple.payoutMultiple
    return stake * multiple
  }
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    return stake * SLOT_OUTCOMES.double.payoutMultiple
  }
  return 0
}

/** Analytic EV of a spin's gross payout. Equals the stake — net EV is zero. */
export function slotSpinEV(stake: number): number {
  return stake * (
    SLOT_OUTCOMES.tripleSeven.probability * SLOT_OUTCOMES.tripleSeven.payoutMultiple
    + SLOT_OUTCOMES.triple.probability * SLOT_OUTCOMES.triple.payoutMultiple
    + SLOT_OUTCOMES.double.probability * SLOT_OUTCOMES.double.payoutMultiple
  )
}
