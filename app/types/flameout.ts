// ── Game State Machine ���─────────────────────────────────────────────────────

export type GamePhase = 'SETUP' | 'WAITING' | 'RUNNING' | 'CRASHED' | 'SETTLING' | 'BUSTED'

// ── Money (all values in integer cents) ──────────────��──────────────────────

export interface BankrollState {
  balance: number
  initialBalance: number
  peakBalance: number
  totalWagered: number
  totalReturned: number
  roundsPlayed: number
  roundsWon: number
  roundsLost: number
  currentStreak: number // positive = wins, negative = losses
  longestWinStreak: number
  longestLossStreak: number
}

// ── Round Records ──────────��────────────────────────────────────────────────

export interface RoundRecord {
  id: number
  crashPoint: number
  bet: number // cents
  cashoutMultiplier: number | null // null = did not cash out
  payout: number // cents
  profit: number // cents
  balanceAfter: number // cents
  timestamp: number
}

export interface CashOutResult {
  success: boolean
  multiplier: number
  betAmount: number // cents
  payout: number // cents
  profit: number // cents
}

// ── Game Settings ───────────��───────────────────────────────────────────────

export interface GameSettings {
  houseEdgePercent: number // 0.5 – 10
  startingBankroll: number // cents
  minBet: number // cents
  maxBet: number // cents
  bettingWindowMs: number
  speedFactor: number
  autoCashoutTarget: number | null // multiplier or null
  autoBet: boolean
}

export const DEFAULT_SETTINGS: GameSettings = {
  houseEdgePercent: 3,
  startingBankroll: 100_000, // $1,000.00
  minBet: 10, // $0.10
  maxBet: 100_000, // $1,000.00
  bettingWindowMs: 5000,
  speedFactor: 1,
  autoCashoutTarget: null,
  autoBet: false
}

// ── Current Round State ─────────────────────────────────────────────────────

export interface CurrentRound {
  crashPoint: number // pre-determined at round start
  currentMultiplier: number
  betAmount: number // cents, 0 if no bet placed
  startedAt: number // timestamp
  elapsedMs: number
  cashedOut: boolean
  cashoutMultiplier: number | null
}

// ── Strategies ───────────────────���──────────────────────────────────────────

export type StrategyType = 'flat' | 'martingale' | 'dalembert' | 'fibonacci' | 'paroli'

export interface StrategyConfig {
  type: StrategyType
  baseBet: number // cents
  cashoutTarget: number
  maxBet?: number // cents
}

export interface BatchSimConfig {
  rounds: number
  houseEdgePercent: number
  startingBankroll: number // cents
  strategy: StrategyConfig
  seed?: number
}

export interface BatchSimResult {
  finalBalance: number
  peakBalance: number
  troughBalance: number
  roundsPlayed: number
  roundsWon: number
  roundsLost: number
  totalWagered: number
  totalReturned: number
  empiricalRTP: number
  busted: boolean
  bustedAtRound: number | null
  balanceCurve: number[]
}

// ── Analytics ─────────────��───────────────────────────��─────────────────────

export interface DistributionBin {
  label: string
  min: number
  max: number
  count: number
  expected: number // theoretical count for comparison
}

export interface StreakStats {
  currentStreak: number
  longestWinStreak: number
  longestLossStreak: number
  streakDistribution: Map<number, number> // streak length → frequency
}

// ── Setup Config (passed from setup screen) ────��────────────────────���───────

export interface SetupConfig {
  houseEdgePercent: number
  startingBankroll: number // dollars (converted to cents in store)
  speedFactor: number
}

// ── Helpers ───────────���─────────────────────────��───────────────────────────

export function centsToDollars(cents: number): number {
  return cents / 100
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function formatMultiplier(m: number): string {
  return `${m.toFixed(2)}×`
}
