import type { RandomFn } from './flameout-rng'

/**
 * Generate a crash point from the inverse distribution.
 *
 * P(crash >= m) = rtp / m
 *
 * When R < (1 - rtp), instant crash at 1.00×.
 * Otherwise: crashPoint = floor(100 × rtp / (1 - R)) / 100
 */
export function generateCrashPoint(houseEdgePercent: number, random: RandomFn = Math.random): number {
  const rtp = 1 - houseEdgePercent / 100
  const R = random()

  // Instant crash — frequency equals house edge
  if (R < (1 - rtp)) return 1.00

  const crashPoint = Math.floor((100 * rtp) / (1 - R)) / 100
  return Math.max(1.00, crashPoint)
}

/**
 * Multiplier at a given elapsed time.
 * Exponential growth: m = e^(growthRate × t × speedFactor)
 * Calibrated so 2.00× is reached in ~5s at 1× speed.
 */
export function currentMultiplier(elapsedMs: number, speedFactor: number = 1): number {
  const t = (elapsedMs / 1000) * speedFactor
  const growthRate = 0.15
  return Math.floor(Math.exp(growthRate * t) * 100) / 100
}

/**
 * Time in ms to reach a given multiplier at a given speed.
 * Inverse of currentMultiplier: t = ln(m) / (growthRate × speedFactor)
 */
export function timeToMultiplier(multiplier: number, speedFactor: number = 1): number {
  const growthRate = 0.15
  return (Math.log(multiplier) / (growthRate * speedFactor)) * 1000
}

/**
 * Probability of the multiplier reaching at least `m`.
 * P(crash >= m) = rtp / m
 */
export function probabilityOfReaching(multiplier: number, houseEdgePercent: number): number {
  const rtp = 1 - houseEdgePercent / 100
  return Math.min(1, rtp / multiplier)
}

/**
 * Expected value per $1 bet at any cashout target.
 * EV = rtp - 1 (invariant — does not depend on cashout target).
 */
export function expectedValuePerDollar(houseEdgePercent: number): number {
  return (1 - houseEdgePercent / 100) - 1
}

/**
 * Calculate payout in cents using integer math.
 * payout = floor(betCents × multiplier)
 */
export function calculatePayoutCents(betCents: number, multiplier: number): number {
  return Math.floor(betCents * multiplier)
}

/**
 * Hourly expected cost of play.
 * cost = betSize × roundsPerHour × houseEdge
 */
export function hourlyCostCents(betCents: number, roundsPerHour: number, houseEdgePercent: number): number {
  return Math.round(betCents * roundsPerHour * (houseEdgePercent / 100))
}

/**
 * Break-even win rate for a given cashout target.
 * breakEven = 1 / multiplier
 */
export function breakEvenRate(multiplier: number): number {
  return 1 / multiplier
}

/**
 * Distribution bins for crash point histogram.
 */
export const DISTRIBUTION_BINS = [
  { label: '1.00×', min: 1.00, max: 1.00 },
  { label: '1.01–1.20×', min: 1.01, max: 1.20 },
  { label: '1.20–1.50×', min: 1.20, max: 1.50 },
  { label: '1.50–2.00×', min: 1.50, max: 2.00 },
  { label: '2.00–3.00×', min: 2.00, max: 3.00 },
  { label: '3.00–5.00×', min: 3.00, max: 5.00 },
  { label: '5.00–10.0×', min: 5.00, max: 10.00 },
  { label: '10.0–50.0×', min: 10.00, max: 50.00 },
  { label: '50.0×+', min: 50.00, max: Infinity }
] as const

/**
 * Theoretical probability of crash point falling in a bin.
 * P(min <= crash < max) = rtp/min - rtp/max
 */
export function binProbability(min: number, max: number, houseEdgePercent: number): number {
  const rtp = 1 - houseEdgePercent / 100
  if (min === 1.00 && max === 1.00) {
    return houseEdgePercent / 100
  }
  const pMin = max === Infinity ? 0 : rtp / max
  return (rtp / min) - pMin
}
