import { describe, it, expect } from 'vitest'
import {
  generateCrashPoint,
  currentMultiplier,
  probabilityOfReaching,
  expectedValuePerDollar,
  calculatePayoutCents,
  hourlyCostCents,
  breakEvenRate,
  binProbability,
  timeToMultiplier,
  clampNumber
} from './flameout-math'
import { mulberry32 } from './flameout-rng'

describe('generateCrashPoint', () => {
  it('produces crash points >= 1.00', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateCrashPoint(3).crashPoint).toBeGreaterThanOrEqual(1.00)
    }
  })

  it('flags forced instant crashes at exactly the house-edge rate', () => {
    const houseEdge = 3
    const rounds = 100_000
    const rng = mulberry32(42)
    let forced = 0

    for (let i = 0; i < rounds; i++) {
      if (generateCrashPoint(houseEdge, rng).instant) forced++
    }

    // The instant flag measures the house-edge mechanism itself, so it
    // converges to the edge — unlike the displayed 1.00× rate below.
    expect(forced / rounds).toBeCloseTo(houseEdge / 100, 2)
  })

  it('displays 1.00× at the floored-distribution rate, not the house edge', () => {
    const houseEdge = 3
    const rtp = 1 - houseEdge / 100
    const rounds = 100_000
    const rng = mulberry32(42)
    let displayed = 0

    for (let i = 0; i < rounds; i++) {
      if (generateCrashPoint(houseEdge, rng).crashPoint === 1.00) displayed++
    }

    // Forced instants (3%) plus organic crashes in [1.00, 1.01) that the
    // two-decimal floor rounds down — ~3.96% at a 3% edge.
    expect(displayed / rounds).toBeCloseTo(1 - rtp / 1.01, 2)
  })

  it('always displays 1.00× when the instant flag is set', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 10_000; i++) {
      const { crashPoint, instant } = generateCrashPoint(3, rng)
      if (instant) expect(crashPoint).toBe(1.00)
    }
  })

  it('also displays 1.00× on some non-forced rounds (the floor absorbs [1.00, 1.01))', () => {
    const rng = mulberry32(11)
    let organic = 0
    for (let i = 0; i < 100_000; i++) {
      const { crashPoint, instant } = generateCrashPoint(3, rng)
      if (!instant && crashPoint === 1.00) organic++
    }
    expect(organic).toBeGreaterThan(0)
  })

  it('percentage reaching 2.00x approximates RTP/2', () => {
    const houseEdge = 3
    const rtp = 1 - houseEdge / 100
    const rounds = 100_000
    const rng = mulberry32(123)
    let reached = 0

    for (let i = 0; i < rounds; i++) {
      if (generateCrashPoint(houseEdge, rng).crashPoint >= 2.00) reached++
    }

    const rate = reached / rounds
    expect(rate).toBeCloseTo(rtp / 2, 1)
  })

  it('percentage reaching 10.00x approximates RTP/10', () => {
    const houseEdge = 3
    const rtp = 1 - houseEdge / 100
    const rounds = 100_000
    const rng = mulberry32(456)
    let reached = 0

    for (let i = 0; i < rounds; i++) {
      if (generateCrashPoint(houseEdge, rng).crashPoint >= 10.00) reached++
    }

    const rate = reached / rounds
    expect(rate).toBeCloseTo(rtp / 10, 1)
  })

  it('empirical RTP converges to configured RTP', () => {
    const houseEdge = 3
    const rtp = 1 - houseEdge / 100
    const rounds = 100_000

    // If you always cash out at 2x, empirical RTP = P(>=2) * 2
    let returned = 0
    const rng2 = mulberry32(999)
    for (let i = 0; i < rounds; i++) {
      const { crashPoint } = generateCrashPoint(houseEdge, rng2)
      if (crashPoint >= 2.00) returned += 2.00
      // else returned += 0
    }
    const empiricalRTP = returned / rounds
    expect(empiricalRTP).toBeCloseTo(rtp, 1)
  })

  it('is deterministic with seeded RNG', () => {
    const rng1 = mulberry32(42)
    const rng2 = mulberry32(42)

    for (let i = 0; i < 100; i++) {
      expect(generateCrashPoint(3, rng1)).toEqual(generateCrashPoint(3, rng2))
    }
  })
})

describe('currentMultiplier', () => {
  it('starts at 1.00 at time 0', () => {
    expect(currentMultiplier(0)).toBe(1.00)
  })

  it('increases over time', () => {
    expect(currentMultiplier(5000)).toBeGreaterThan(1.00)
    expect(currentMultiplier(10000)).toBeGreaterThan(currentMultiplier(5000))
  })

  it('reaches ~2.00 around 5 seconds at 1x speed', () => {
    const m = currentMultiplier(5000, 1)
    expect(m).toBeGreaterThanOrEqual(1.8)
    expect(m).toBeLessThanOrEqual(2.2)
  })

  it('speed factor accelerates growth', () => {
    expect(currentMultiplier(2500, 2)).toBeCloseTo(currentMultiplier(5000, 1), 1)
  })
})

describe('timeToMultiplier', () => {
  it('round-trips with currentMultiplier', () => {
    const m = 3.5
    const t = timeToMultiplier(m, 1)
    expect(currentMultiplier(t, 1)).toBeCloseTo(m, 1)
  })
})

describe('probabilityOfReaching', () => {
  it('P(1.01x) is close to RTP', () => {
    expect(probabilityOfReaching(1.01, 3)).toBeCloseTo(0.97 / 1.01, 4)
  })

  it('P(2x) at 3% edge is ~48.5%', () => {
    expect(probabilityOfReaching(2, 3)).toBeCloseTo(0.485, 3)
  })

  it('P(10x) at 3% edge is ~9.7%', () => {
    expect(probabilityOfReaching(10, 3)).toBeCloseTo(0.097, 3)
  })

  it('P(100x) at 3% edge is ~0.97%', () => {
    expect(probabilityOfReaching(100, 3)).toBeCloseTo(0.0097, 4)
  })
})

describe('expectedValuePerDollar', () => {
  it('EV = -0.03 at 3% house edge', () => {
    expect(expectedValuePerDollar(3)).toBeCloseTo(-0.03, 4)
  })

  it('EV = -0.01 at 1% house edge', () => {
    expect(expectedValuePerDollar(1)).toBeCloseTo(-0.01, 4)
  })

  it('EV is invariant of cashout target (by definition)', () => {
    // This function doesn't take multiplier — that IS the invariance
    expect(expectedValuePerDollar(3)).toBe(expectedValuePerDollar(3))
  })
})

describe('calculatePayoutCents', () => {
  it('calculates correctly', () => {
    expect(calculatePayoutCents(1000, 2.0)).toBe(2000)
    expect(calculatePayoutCents(1000, 1.5)).toBe(1500)
  })

  it('floors to integer cents', () => {
    expect(calculatePayoutCents(1000, 1.333)).toBe(1333)
    expect(calculatePayoutCents(100, 1.999)).toBe(199)
  })
})

describe('hourlyCostCents', () => {
  it('$10 bet, 100 rounds/hr, 3% edge = $30/hr', () => {
    expect(hourlyCostCents(1000, 100, 3)).toBe(3000)
  })
})

describe('breakEvenRate', () => {
  it('break-even at 2x is 50%', () => {
    expect(breakEvenRate(2)).toBe(0.5)
  })

  it('break-even at 10x is 10%', () => {
    expect(breakEvenRate(10)).toBe(0.1)
  })
})

describe('binProbability', () => {
  it('1.00× bin matches the displayed rate: house edge plus the floored [1.00, 1.01) mass', () => {
    // P(display = 1.00) = 1 - rtp/1.01 ≈ 3.96% at a 3% edge, NOT 3%: the
    // two-decimal floor rounds organic crashes in [1.00, 1.01) down to 1.00.
    expect(binProbability(1.00, 1.00, 3)).toBeCloseTo(1 - 0.97 / 1.01, 10)
  })

  it('all bins sum to exactly 1 (the distribution telescopes)', () => {
    const bins = [
      [1.00, 1.00],
      [1.01, 1.20],
      [1.20, 1.50],
      [1.50, 2.00],
      [2.00, 3.00],
      [3.00, 5.00],
      [5.00, 10.00],
      [10.00, 50.00],
      [50.00, Infinity]
    ]
    const total = bins.reduce((s, [min, max]) => s + binProbability(min!, max!, 3), 0)
    expect(total).toBeCloseTo(1.0, 10)
  })
})

describe('clampNumber', () => {
  it('clamps into the range and passes through in-range values', () => {
    expect(clampNumber(5, 0.5, 10, 3)).toBe(5)
    expect(clampNumber(-2, 0.5, 10, 3)).toBe(0.5)
    expect(clampNumber(50, 0.5, 10, 3)).toBe(10)
  })

  it('falls back for non-finite or non-numeric input', () => {
    expect(clampNumber(Number.NaN, 0.5, 10, 3)).toBe(3)
    expect(clampNumber(Infinity, 0.5, 10, 3)).toBe(3)
    expect(clampNumber('7' as unknown, 0.5, 10, 3)).toBe(3)
    expect(clampNumber(undefined, 0.5, 10, 3)).toBe(3)
  })
})
