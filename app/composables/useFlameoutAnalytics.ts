import { computed } from 'vue'
import { useFlameoutStore } from '~/stores/flameout'
import {
  DISTRIBUTION_BINS,
  binProbability,
  probabilityOfReaching,
  expectedValuePerDollar,
  breakEvenRate,
  hourlyCostCents
} from '~/utils/flameout-math'
import type { DistributionBin } from '~/types/flameout'

export function useFlameoutAnalytics() {
  const store = useFlameoutStore()

  const distributionData = computed((): DistributionBin[] => {
    const total = store.roundHistory.length
    if (total === 0) return []

    return DISTRIBUTION_BINS.map(bin => {
      const count = store.roundHistory.filter((r) => {
        if (bin.min === 1.00 && bin.max === 1.00) return r.crashPoint === 1.00
        if (bin.max === Infinity) return r.crashPoint >= bin.min
        return r.crashPoint >= bin.min && r.crashPoint < bin.max
      }).length

      const expected = binProbability(bin.min, bin.max, store.settings.houseEdgePercent) * total

      return { label: bin.label, min: bin.min, max: bin.max, count, expected }
    })
  })

  const streakStats = computed(() => {
    return {
      currentStreak: store.bankroll.currentStreak,
      longestWinStreak: store.bankroll.longestWinStreak,
      longestLossStreak: store.bankroll.longestLossStreak
    }
  })

  const sessionStats = computed(() => ({
    roundsPlayed: store.bankroll.roundsPlayed,
    roundsWon: store.bankroll.roundsWon,
    roundsLost: store.bankroll.roundsLost,
    winRate: store.winRate,
    totalWagered: store.bankroll.totalWagered,
    totalReturned: store.bankroll.totalReturned,
    empiricalRTP: store.empiricalRTP,
    profitLoss: store.profitLoss,
    peakBalance: store.bankroll.peakBalance,
    maxDrawdown: store.maxDrawdown,
    currentStreak: store.bankroll.currentStreak,
    longestWinStreak: store.bankroll.longestWinStreak,
    longestLossStreak: store.bankroll.longestLossStreak
  }))

  function getProbability(multiplier: number): number {
    return probabilityOfReaching(multiplier, store.settings.houseEdgePercent)
  }

  function getExpectedValue(): number {
    return expectedValuePerDollar(store.settings.houseEdgePercent)
  }

  function getBreakEvenRate(multiplier: number): number {
    return breakEvenRate(multiplier)
  }

  function getHourlyCost(betCents: number, roundsPerHour: number = 100): number {
    return hourlyCostCents(betCents, roundsPerHour, store.settings.houseEdgePercent)
  }

  /**
   * Conditional probability: P(next round >= m) given last N rounds below threshold.
   * Always equals the unconditional probability — rounds are independent.
   */
  function conditionalProbability(multiplier: number, _priorRounds: number, _threshold: number): number {
    return probabilityOfReaching(multiplier, store.settings.houseEdgePercent)
  }

  /**
   * Average crash point from round history.
   */
  const averageCrashPoint = computed(() => {
    if (store.roundHistory.length === 0) return 0
    const sum = store.roundHistory.reduce((s, r) => s + r.crashPoint, 0)
    return sum / store.roundHistory.length
  })

  /**
   * Median crash point from round history.
   */
  const medianCrashPoint = computed(() => {
    if (store.roundHistory.length === 0) return 0
    const sorted = [...store.roundHistory].sort((a, b) => a.crashPoint - b.crashPoint)
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1].crashPoint + sorted[mid].crashPoint) / 2
    }
    return sorted[mid].crashPoint
  })

  /**
   * Percentage of instant crashes (1.00×) in session.
   */
  const instantCrashRate = computed(() => {
    if (store.roundHistory.length === 0) return 0
    const instant = store.roundHistory.filter(r => r.crashPoint === 1.00).length
    return instant / store.roundHistory.length
  })

  return {
    distributionData,
    streakStats,
    sessionStats,
    averageCrashPoint,
    medianCrashPoint,
    instantCrashRate,
    getProbability,
    getExpectedValue,
    getBreakEvenRate,
    getHourlyCost,
    conditionalProbability
  }
}
