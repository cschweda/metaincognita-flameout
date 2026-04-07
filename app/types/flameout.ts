// ── Game State Machine ���─────────────────────────────────────────────────────

export type GamePhase = 'SETUP' | 'WAITING' | 'RUNNING' | 'CRASHED' | 'SETTLING' | 'BUSTED'

export type GameMode = 'classic' | 'gauntlet' | 'jackpot'

export interface GameModeInfo {
  id: GameMode
  name: string
  tagline: string
  description: string
  icon: string
}

export const GAME_MODES: GameModeInfo[] = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'The original crash game',
    description: 'Watch the multiplier rise and cash out before the crash. Pure math, pure tension.',
    icon: 'i-lucide-flame'
  },
  {
    id: 'gauntlet',
    name: 'Gauntlet',
    tagline: 'Dodge, collect, survive',
    description: 'Steer the jet with arrow keys to collect bonuses and dodge obstacles as the multiplier climbs.',
    icon: 'i-lucide-swords'
  },
  {
    id: 'jackpot',
    name: 'Jackpot',
    tagline: 'Hit the slots, win big',
    description: 'Collect slot triggers to spin 3 reels. Triple match = massive payout. Dodge the duds.',
    icon: 'i-lucide-diamond'
  }
]

// ── Gauntlet Mode ──────────────────────────────────────────────────────────

export type GauntletItemType = 'coin' | 'star' | 'diamond' | 'mine' | 'asteroid'

export interface GauntletItem {
  id: number
  type: GauntletItemType
  timeMs: number        // elapsed ms when item is at the jet's x position
  yOffset: number       // pixel offset from the curve (-140 to +140)
  value: number         // cents: positive = bonus, negative = obstacle
  collected: boolean
  missed: boolean       // scrolled past without collection
  radius: number
}

export interface FloatingText {
  x: number
  y: number
  text: string
  color: string
  life: number
  maxLife: number
}

export const GAUNTLET_ITEM_DEFS: Record<GauntletItemType, { color: string; glow: string; minValue: number; maxValue: number; weight: number }> = {
  coin:     { color: '#fbbf24', glow: '#f59e0b', minValue: 100,  maxValue: 500,   weight: 40 },
  star:     { color: '#facc15', glow: '#eab308', minValue: 500,  maxValue: 1500,  weight: 20 },
  diamond:  { color: '#67e8f9', glow: '#22d3ee', minValue: 1000, maxValue: 2500,  weight: 8 },
  mine:     { color: '#ef4444', glow: '#dc2626', minValue: -300, maxValue: -1000, weight: 22 },
  asteroid: { color: '#a1a1aa', glow: '#71717a', minValue: -500, maxValue: -1500, weight: 10 }
}

// ── Jackpot Mode ───────────────────────────────────────────────────────────

export type SlotSymbol = '7' | 'cherry' | 'diamond' | 'bar' | 'star'

export const SLOT_SYMBOLS: SlotSymbol[] = ['7', 'cherry', 'diamond', 'bar', 'star']

export const SLOT_SYMBOL_COLORS: Record<SlotSymbol, string> = {
  '7': '#ef4444',
  cherry: '#f43f5e',
  diamond: '#22d3ee',
  bar: '#f59e0b',
  star: '#facc15'
}

export interface JackpotTrigger {
  id: number
  timeMs: number
  yOffset: number
  baseValue: number   // cents — multiplied by match result
  collected: boolean
  missed: boolean
  radius: number
}

export type SlotSpinPhase = 'idle' | 'spinning' | 'stop1' | 'stop2' | 'stop3' | 'result'

export interface SlotSpinState {
  phase: SlotSpinPhase
  reels: [SlotSymbol, SlotSymbol, SlotSymbol]
  startTime: number
  payout: number       // cents
  triggerX: number      // screen position for the overlay
  triggerY: number
}

// ── Money (all values in integer cents) ──────────────────────────────────

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
  gameMode: GameMode
}

export const DEFAULT_SETTINGS: GameSettings = {
  houseEdgePercent: 3,
  startingBankroll: 100_000, // $1,000.00
  minBet: 10, // $0.10
  maxBet: 100_000, // $1,000.00
  bettingWindowMs: 5000,
  speedFactor: 1,
  autoCashoutTarget: null,
  autoBet: false,
  gameMode: 'classic'
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
  gameMode: GameMode
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
