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
    description: 'Grab golden triggers to stake a 3-reel spin. Triples pay big. Time freezes while the reels roll.',
    icon: 'i-lucide-diamond'
  }
]

// ── Gauntlet Mode ──────────────────────────────────────────────────────────

export type GauntletItemType = 'coin' | 'star' | 'diamond' | 'mine' | 'asteroid'

export interface GauntletItem {
  id: number
  type: GauntletItemType
  timeMs: number // elapsed ms when item is at the jet's x position
  yOffsetFrac: number // offset from the curve as a fraction of canvas height (-0.38 to +0.38)
  value: number // cents: positive = bonus, negative = obstacle
  collected: boolean
  missed: boolean // scrolled past without collection
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

/**
 * Item mix is balanced so the EV of a spawned item is exactly $0.00
 * (sum of weight × midpoint value = 0). The side game adds variance and a
 * skill element, not a money faucet — see gauntletSpawnEV() and its test.
 */
export const GAUNTLET_ITEM_DEFS: Record<GauntletItemType, { color: string, glow: string, minValue: number, maxValue: number, weight: number }> = {
  coin: { color: '#fbbf24', glow: '#f59e0b', minValue: 100, maxValue: 500, weight: 40 },
  star: { color: '#facc15', glow: '#eab308', minValue: 600, maxValue: 1200, weight: 15 },
  diamond: { color: '#67e8f9', glow: '#22d3ee', minValue: 1000, maxValue: 2000, weight: 5 },
  mine: { color: '#ef4444', glow: '#dc2626', minValue: -500, maxValue: -1000, weight: 28 },
  asteroid: { color: '#a1a1aa', glow: '#71717a', minValue: -700, maxValue: -1300, weight: 12 }
}

// ── Jackpot Mode ───────────────────────────────────────────────────────────

export type SlotSymbol = '7' | 'cherry' | 'diamond' | 'bar' | 'star'

export const SLOT_SYMBOLS: SlotSymbol[] = ['7', 'cherry', 'diamond', 'bar', 'star']

export const SLOT_SYMBOL_COLORS: Record<SlotSymbol, string> = {
  7: '#ef4444',
  cherry: '#f43f5e',
  diamond: '#22d3ee',
  bar: '#f59e0b',
  star: '#facc15'
}

export interface JackpotTrigger {
  id: number
  timeMs: number
  yOffsetFrac: number // offset from the curve as a fraction of canvas height
  stake: number // cents — deducted on collection, multiplied by match result
  collected: boolean
  missed: boolean
  radius: number
}

export type SlotSpinPhase = 'idle' | 'spinning' | 'stop1' | 'stop2' | 'stop3' | 'result'

export interface SlotSpinState {
  phase: SlotSpinPhase
  reels: [SlotSymbol, SlotSymbol, SlotSymbol]
  startTime: number
  stake: number // cents paid to start the spin
  payout: number // cents (gross — stake already deducted at collection)
  triggerX: number // screen position for the overlay
  triggerY: number
}

/**
 * Slot payout schedule, as multiples of the stake.
 * EV = 0.02×10 + 0.08×5 + 0.20×2 = 1.0× the stake — the spin returns its
 * cost in expectation. Variance only, no faucet. See slotSpinEV() test.
 */
export const SLOT_OUTCOMES = {
  tripleSeven: { probability: 0.02, payoutMultiple: 10 },
  triple: { probability: 0.08, payoutMultiple: 5 },
  double: { probability: 0.20, payoutMultiple: 2 }
} as const

// ── Money (all values in integer cents) ──────────────────────────────────

export interface BankrollState {
  balance: number
  initialBalance: number
  peakBalance: number
  totalWagered: number
  totalReturned: number
  // Net result of variant side games (gauntlet items, jackpot spins).
  // Tracked separately so it never contaminates the crash-game RTP stats.
  sideGameNet: number
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

// ── Game Settings ────────────────────────────────────────────────────────────

export interface GameSettings {
  houseEdgePercent: number // 0.5 – 10
  startingBankroll: number // cents
  minBet: number // cents
  maxBet: number // cents
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
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`
}

export function formatMultiplier(m: number): string {
  return `${m.toFixed(2)}×`
}
