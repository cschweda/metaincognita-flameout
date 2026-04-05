import { describe, it, expect } from 'vitest'
import { nextBet, runBatchSimulation } from './useFlameoutStrategy'

describe('nextBet', () => {
  it('flat: always returns base bet', () => {
    const config = { type: 'flat' as const, baseBet: 100, cashoutTarget: 2 }
    expect(nextBet(config, null, 100, 0, 0)).toBe(100)
    expect(nextBet(config, true, 100, 0, 1)).toBe(100)
    expect(nextBet(config, false, 100, 1, 0)).toBe(100)
  })

  it('martingale: doubles after loss, resets after win', () => {
    const config = { type: 'martingale' as const, baseBet: 100, cashoutTarget: 2 }
    expect(nextBet(config, null, 100, 0, 0)).toBe(100) // first bet
    expect(nextBet(config, false, 100, 1, 0)).toBe(200) // after loss
    expect(nextBet(config, false, 200, 2, 0)).toBe(400) // after 2nd loss
    expect(nextBet(config, true, 400, 0, 1)).toBe(100) // after win
  })

  it('martingale: respects max bet cap', () => {
    const config = { type: 'martingale' as const, baseBet: 100, cashoutTarget: 2, maxBet: 300 }
    expect(nextBet(config, false, 200, 2, 0)).toBe(300) // capped
  })

  it('dalembert: increases by base after loss, decreases after win', () => {
    const config = { type: 'dalembert' as const, baseBet: 100, cashoutTarget: 2 }
    expect(nextBet(config, null, 100, 0, 0)).toBe(100)
    expect(nextBet(config, false, 100, 1, 0)).toBe(200)
    expect(nextBet(config, false, 200, 2, 0)).toBe(300)
    expect(nextBet(config, true, 300, 0, 1)).toBe(200)
    expect(nextBet(config, true, 100, 0, 1)).toBe(100) // floor at base
  })

  it('paroli: doubles after win up to 3, resets after loss', () => {
    const config = { type: 'paroli' as const, baseBet: 100, cashoutTarget: 2 }
    expect(nextBet(config, null, 100, 0, 0)).toBe(100)
    expect(nextBet(config, true, 100, 0, 1)).toBe(200)
    expect(nextBet(config, true, 200, 0, 2)).toBe(400)
    expect(nextBet(config, true, 400, 0, 3)).toBe(100) // reset after 3 wins
    expect(nextBet(config, false, 200, 1, 0)).toBe(100) // reset after loss
  })
})

describe('runBatchSimulation', () => {
  it('runs specified number of rounds', () => {
    const result = runBatchSimulation({
      rounds: 100,
      houseEdgePercent: 3,
      startingBankroll: 100000,
      strategy: { type: 'flat', baseBet: 1000, cashoutTarget: 2 },
      seed: 42
    })

    expect(result.roundsPlayed).toBe(100)
    expect(result.roundsWon + result.roundsLost).toBe(100)
  })

  it('is deterministic with same seed', () => {
    const config = {
      rounds: 500,
      houseEdgePercent: 3,
      startingBankroll: 100000,
      strategy: { type: 'flat' as const, baseBet: 1000, cashoutTarget: 2 },
      seed: 42
    }

    const r1 = runBatchSimulation(config)
    const r2 = runBatchSimulation(config)

    expect(r1.finalBalance).toBe(r2.finalBalance)
    expect(r1.roundsWon).toBe(r2.roundsWon)
    expect(r1.balanceCurve).toEqual(r2.balanceCurve)
  })

  it('empirical RTP converges toward configured RTP over many rounds', () => {
    const result = runBatchSimulation({
      rounds: 50000,
      houseEdgePercent: 3,
      startingBankroll: 10_000_000, // large bankroll to avoid bust
      strategy: { type: 'flat', baseBet: 100, cashoutTarget: 2 },
      seed: 123
    })

    expect(result.empiricalRTP).toBeCloseTo(0.97, 1)
  })

  it('detects bust correctly', () => {
    const result = runBatchSimulation({
      rounds: 10000,
      houseEdgePercent: 3,
      startingBankroll: 500, // small bankroll
      strategy: { type: 'martingale', baseBet: 100, cashoutTarget: 2 },
      seed: 42
    })

    // Martingale with small bankroll should bust frequently
    if (result.busted) {
      expect(result.bustedAtRound).toBeGreaterThan(0)
      expect(result.roundsPlayed).toBeLessThan(10000)
    }
  })

  it('balance curve has correct length', () => {
    const result = runBatchSimulation({
      rounds: 50,
      houseEdgePercent: 3,
      startingBankroll: 100000,
      strategy: { type: 'flat', baseBet: 1000, cashoutTarget: 2 },
      seed: 42
    })

    // Initial balance + one entry per round played
    expect(result.balanceCurve.length).toBe(result.roundsPlayed + 1)
  })
})
