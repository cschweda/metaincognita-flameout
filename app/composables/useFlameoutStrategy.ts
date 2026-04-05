import type { StrategyConfig, StrategyType, BatchSimConfig, BatchSimResult } from '~/types/flameout'
import { generateCrashPoint, calculatePayoutCents } from '~/utils/flameout-math'
import { createRng } from '~/utils/flameout-rng'

/**
 * Calculate the next bet for a given strategy and history.
 */
export function nextBet(
  strategy: StrategyConfig,
  previousWon: boolean | null,
  currentBet: number,
  consecutiveLosses: number,
  consecutiveWins: number
): number {
  const cap = strategy.maxBet || Infinity

  switch (strategy.type) {
    case 'flat':
      return strategy.baseBet

    case 'martingale':
      if (previousWon === null || previousWon) return strategy.baseBet
      return Math.min(currentBet * 2, cap)

    case 'dalembert':
      if (previousWon === null) return strategy.baseBet
      if (previousWon) return Math.max(strategy.baseBet, currentBet - strategy.baseBet)
      return Math.min(currentBet + strategy.baseBet, cap)

    case 'fibonacci': {
      if (previousWon === null || previousWon) return strategy.baseBet
      // Generate Fibonacci sequence position based on consecutive losses
      const fib = fibonacci(consecutiveLosses + 1)
      return Math.min(fib * strategy.baseBet, cap)
    }

    case 'paroli':
      if (previousWon === null || !previousWon) return strategy.baseBet
      if (consecutiveWins >= 3) return strategy.baseBet
      return Math.min(currentBet * 2, cap)

    default:
      return strategy.baseBet
  }
}

function fibonacci(n: number): number {
  let a = 1, b = 1
  for (let i = 2; i < n; i++) {
    const temp = a + b
    a = b
    b = temp
  }
  return b
}

/**
 * Run a batch simulation with the given config.
 */
export function runBatchSimulation(config: BatchSimConfig): BatchSimResult {
  const random = createRng(config.seed)
  let balance = config.startingBankroll
  let peakBalance = balance
  let troughBalance = balance
  let totalWagered = 0
  let totalReturned = 0
  let roundsWon = 0
  let roundsLost = 0
  let busted = false
  let bustedAtRound: number | null = null
  let consecutiveLosses = 0
  let consecutiveWins = 0
  let previousWon: boolean | null = null
  let currentBet = config.strategy.baseBet

  const balanceCurve: number[] = [balance]

  let roundsPlayed = 0
  for (let i = 0; i < config.rounds; i++) {
    // Calculate bet
    currentBet = nextBet(config.strategy, previousWon, currentBet, consecutiveLosses, consecutiveWins)

    // Can't bet more than balance
    if (currentBet > balance) currentBet = balance
    if (currentBet < 1) {
      busted = true
      bustedAtRound = i
      break
    }

    const crashPoint = generateCrashPoint(config.houseEdgePercent, random)

    balance -= currentBet
    totalWagered += currentBet
    roundsPlayed++

    const won = crashPoint >= config.strategy.cashoutTarget
    if (won) {
      const payout = calculatePayoutCents(currentBet, config.strategy.cashoutTarget)
      balance += payout
      totalReturned += payout
      roundsWon++
      consecutiveWins++
      consecutiveLosses = 0
    } else {
      roundsLost++
      consecutiveLosses++
      consecutiveWins = 0
    }

    previousWon = won

    if (balance > peakBalance) peakBalance = balance
    if (balance < troughBalance) troughBalance = balance
    balanceCurve.push(balance)

    if (balance < 1) {
      busted = true
      bustedAtRound = i + 1
      break
    }
  }

  return {
    finalBalance: balance,
    peakBalance,
    troughBalance,
    roundsPlayed,
    roundsWon,
    roundsLost,
    totalWagered,
    totalReturned,
    empiricalRTP: totalWagered > 0 ? totalReturned / totalWagered : 0,
    busted,
    bustedAtRound,
    balanceCurve
  }
}

/**
 * All available strategy types with display names.
 */
export const STRATEGY_OPTIONS: { value: StrategyType; label: string; description: string }[] = [
  { value: 'flat', label: 'Flat', description: 'Same bet every round' },
  { value: 'martingale', label: 'Martingale', description: 'Double after loss, reset after win' },
  { value: 'dalembert', label: "D'Alembert", description: 'Increase by base after loss, decrease after win' },
  { value: 'fibonacci', label: 'Fibonacci', description: 'Follow Fibonacci sequence on losses' },
  { value: 'paroli', label: 'Paroli', description: 'Double after win (up to 3), reset after loss' }
]

export function useFlameoutStrategy() {
  return {
    nextBet,
    runBatchSimulation,
    STRATEGY_OPTIONS
  }
}
