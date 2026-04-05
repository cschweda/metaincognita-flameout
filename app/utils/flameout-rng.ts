/**
 * Seeded PRNG — mulberry32 algorithm.
 * Produces deterministic sequences for reproducible strategy comparison.
 * NOT cryptographically secure — irrelevant for a simulator.
 */

export type RandomFn = () => number

export function mulberry32(seed: number): RandomFn {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed?: number): RandomFn {
  if (seed !== undefined) {
    return mulberry32(seed)
  }
  return Math.random
}
