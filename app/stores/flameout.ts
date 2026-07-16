import { defineStore } from 'pinia'
import type {
  GamePhase,
  GameMode,
  GameSettings,
  BankrollState,
  RoundRecord,
  CurrentRound,
  SetupConfig
} from '~/types/flameout'
import { DEFAULT_SETTINGS, GAME_MODES, dollarsToCents } from '~/types/flameout'
import { clampNumber } from '~/utils/flameout-math'

const STORAGE_KEY = 'flameout-session'

// Bump when the persisted shape changes; loadFromLocalStorage migrates.
// v3: in-flight rounds persist (currentRound + real phase) so a reload or
// closed tab resolves the round instead of rolling the bet back.
const STORAGE_VERSION = 3

const GAME_PHASES: GamePhase[] = ['SETUP', 'WAITING', 'RUNNING', 'CRASHED', 'SETTLING', 'BUSTED']

function emptyBankroll(balanceCents = 0): BankrollState {
  return {
    balance: balanceCents,
    initialBalance: balanceCents,
    peakBalance: balanceCents,
    totalWagered: 0,
    totalReturned: 0,
    sideGameNet: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    roundsLost: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0
  }
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Coerce a persisted bankroll into a valid shape — bad fields fall back to 0. */
function sanitizeBankroll(raw: unknown): BankrollState {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const clean = emptyBankroll()
  for (const key of Object.keys(clean) as (keyof BankrollState)[]) {
    clean[key] = asFiniteNumber(source[key], clean[key])
  }
  return clean
}

/** Coerce a persisted in-flight round; null if it can't be resolved. */
function sanitizeRound(raw: unknown): CurrentRound | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const { crashPoint, startedAt, cashoutMultiplier } = source
  // Without a valid crash point and start timestamp the round has no outcome
  if (typeof crashPoint !== 'number' || !Number.isFinite(crashPoint) || crashPoint < 1) return null
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt) || startedAt <= 0) return null
  return {
    crashPoint,
    instant: source.instant === true,
    currentMultiplier: Math.max(1, asFiniteNumber(source.currentMultiplier, 1)),
    betAmount: Math.max(0, asFiniteNumber(source.betAmount, 0)),
    startedAt,
    elapsedMs: Math.max(0, asFiniteNumber(source.elapsedMs, 0)),
    cashedOut: source.cashedOut === true,
    cashoutMultiplier: typeof cashoutMultiplier === 'number' && Number.isFinite(cashoutMultiplier)
      ? cashoutMultiplier
      : null
  }
}

/**
 * Coerce persisted settings into the documented ranges — the same clamps
 * initializeGame applies, repeated at the load boundary so a hand-edited
 * payload can't smuggle in a negative edge, an absurd speed, or an unknown
 * game mode. (The bankroll and round get this treatment; settings should too.)
 */
function sanitizeSettings(raw: unknown): GameSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const defaults = DEFAULT_SETTINGS
  const minBet = Math.round(clampNumber(source.minBet, 1, 1_000_000, defaults.minBet))
  const autoCashoutTarget
    = typeof source.autoCashoutTarget === 'number'
      && Number.isFinite(source.autoCashoutTarget)
      && source.autoCashoutTarget >= 1.01
      ? source.autoCashoutTarget
      : null
  return {
    houseEdgePercent: clampNumber(source.houseEdgePercent, 0.5, 10, defaults.houseEdgePercent),
    startingBankroll: Math.round(clampNumber(source.startingBankroll, 100, 100_000_000, defaults.startingBankroll)),
    minBet,
    maxBet: Math.round(clampNumber(source.maxBet, minBet, 100_000_000, defaults.maxBet)),
    speedFactor: clampNumber(source.speedFactor, 0.25, 10, defaults.speedFactor),
    autoCashoutTarget,
    autoBet: source.autoBet === true,
    gameMode: GAME_MODES.some(m => m.id === source.gameMode) ? source.gameMode as GameMode : 'classic'
  }
}

export const useFlameoutStore = defineStore('flameout', {
  state: () => ({
    phase: 'SETUP' as GamePhase,

    settings: { ...DEFAULT_SETTINGS } as GameSettings,

    bankroll: emptyBankroll(),

    currentRound: null as CurrentRound | null,

    roundHistory: [] as RoundRecord[],

    // Monotonic round id — survives history trimming so ids never collide
    nextRoundId: 1,

    // Current bet input (cents)
    pendingBet: 1000, // $10.00 default

    // Jackpot mode: freeze round time while the reels spin
    jackpotSpinActive: false
  }),

  getters: {
    rtp: (state): number => 1 - state.settings.houseEdgePercent / 100,

    isPlaying: (state): boolean => state.phase !== 'SETUP',

    canPlaceBet: (state): boolean => {
      return state.phase === 'WAITING'
        && state.pendingBet >= state.settings.minBet
        && state.pendingBet <= Math.min(state.settings.maxBet, state.bankroll.balance)
    },

    canCashOut: (state): boolean => {
      return state.phase === 'RUNNING'
        && state.currentRound !== null
        && state.currentRound.betAmount > 0
        && !state.currentRound.cashedOut
        && !state.jackpotSpinActive
    },

    winRate: (state): number => {
      if (state.bankroll.roundsPlayed === 0) return 0
      return state.bankroll.roundsWon / state.bankroll.roundsPlayed
    },

    empiricalRTP: (state): number => {
      if (state.bankroll.totalWagered === 0) return 0
      return state.bankroll.totalReturned / state.bankroll.totalWagered
    },

    profitLoss: (state): number => {
      return state.bankroll.balance - state.bankroll.initialBalance
    },

    maxDrawdown: (state): number => {
      return state.bankroll.peakBalance - state.bankroll.balance
    },

    lastCrashPoints: (state): number[] => {
      return state.roundHistory.slice(-30).map(r => r.crashPoint).reverse()
    }
  },

  actions: {
    initializeGame(config: SetupConfig) {
      // Setup values arrive from free-typed inputs — clamp to the documented
      // ranges so a negative edge or zero bankroll can't start a broken game.
      const bankrollCents = dollarsToCents(clampNumber(config.startingBankroll, 1, 1_000_000, 1000))

      this.settings = {
        ...DEFAULT_SETTINGS,
        houseEdgePercent: clampNumber(config.houseEdgePercent, 0.5, 10, DEFAULT_SETTINGS.houseEdgePercent),
        startingBankroll: bankrollCents,
        speedFactor: clampNumber(config.speedFactor, 0.25, 10, DEFAULT_SETTINGS.speedFactor),
        gameMode: GAME_MODES.some(m => m.id === config.gameMode) ? config.gameMode : 'classic'
      }

      this.bankroll = emptyBankroll(bankrollCents)
      this.currentRound = null
      this.roundHistory = []
      this.nextRoundId = 1
      this.pendingBet = Math.min(1000, bankrollCents)
      this.jackpotSpinActive = false
      this.phase = 'WAITING'

      // A session exists the moment it's configured — navigating back to the
      // setup screen must find it resumable, not wipe it.
      this.saveToLocalStorage()
    },

    setPhase(phase: GamePhase) {
      this.phase = phase
    },

    startRound(crashPoint: number, instant = false) {
      this.currentRound = {
        crashPoint,
        instant,
        currentMultiplier: 1.00,
        betAmount: 0,
        startedAt: Date.now(),
        elapsedMs: 0,
        cashedOut: false,
        cashoutMultiplier: null
      }
    },

    // Stamp the moment the multiplier starts climbing. Elapsed time is always
    // derived from this timestamp, so a round keeps flowing (and can be
    // resolved) even if the page unmounts mid-flight.
    beginRun() {
      if (!this.currentRound) return
      this.currentRound.startedAt = Date.now()
      this.currentRound.elapsedMs = 0
    },

    // Push the start timestamp forward to freeze round time (jackpot spins).
    shiftRoundStart(ms: number) {
      if (!this.currentRound) return
      this.currentRound.startedAt += ms
    },

    // Returns whether the bet was accepted — callers must not start the run
    // on a rejected bet, or the round flies with nothing at stake.
    placeBet(amount: number): boolean {
      if (!this.currentRound) return false
      // NaN slips through every comparison below (all false), which would
      // poison the balance with NaN — reject it explicitly.
      if (!Number.isFinite(amount)) return false
      if (amount > this.bankroll.balance) return false
      if (amount < this.settings.minBet) return false
      if (amount > this.settings.maxBet) return false

      this.currentRound.betAmount = amount
      this.bankroll.balance -= amount
      this.bankroll.totalWagered += amount
      return true
    },

    updateMultiplier(multiplier: number, elapsedMs: number) {
      if (!this.currentRound) return
      this.currentRound.currentMultiplier = multiplier
      this.currentRound.elapsedMs = elapsedMs
    },

    cashOut(multiplier: number): boolean {
      if (!this.currentRound || this.currentRound.cashedOut) return false
      if (this.currentRound.betAmount === 0) return false

      this.currentRound.cashedOut = true
      this.currentRound.cashoutMultiplier = multiplier

      const payout = Math.floor(this.currentRound.betAmount * multiplier)
      this.bankroll.balance += payout
      this.bankroll.totalReturned += payout

      if (this.bankroll.balance > this.bankroll.peakBalance) {
        this.bankroll.peakBalance = this.bankroll.balance
      }

      return true
    },

    settleRound() {
      if (!this.currentRound) return
      this.jackpotSpinActive = false

      const round = this.currentRound

      // Don't record rounds where no bet was placed
      if (round.betAmount === 0) {
        this.currentRound = null
        return
      }

      const won = round.cashedOut
      const payout = won ? Math.floor(round.betAmount * (round.cashoutMultiplier || 0)) : 0
      const profit = payout - round.betAmount

      const record: RoundRecord = {
        id: this.nextRoundId++,
        crashPoint: round.crashPoint,
        instant: round.instant,
        bet: round.betAmount,
        cashoutMultiplier: round.cashoutMultiplier,
        payout,
        profit,
        balanceAfter: this.bankroll.balance,
        timestamp: Date.now()
      }

      this.roundHistory.push(record)

      this.bankroll.roundsPlayed++

      if (won) {
        this.bankroll.roundsWon++
        this.bankroll.currentStreak = Math.max(1, this.bankroll.currentStreak + 1)
        if (this.bankroll.currentStreak > this.bankroll.longestWinStreak) {
          this.bankroll.longestWinStreak = this.bankroll.currentStreak
        }
      } else {
        this.bankroll.roundsLost++
        this.bankroll.currentStreak = Math.min(-1, this.bankroll.currentStreak - 1)
        if (Math.abs(this.bankroll.currentStreak) > this.bankroll.longestLossStreak) {
          this.bankroll.longestLossStreak = Math.abs(this.bankroll.currentStreak)
        }
      }

      // Keep only last 1000 rounds
      if (this.roundHistory.length > 1000) {
        this.roundHistory = this.roundHistory.slice(-1000)
      }

      this.currentRound = null

      // Check bust
      if (this.bankroll.balance < this.settings.minBet) {
        this.phase = 'BUSTED'
      }
    },

    rebuy(amountCents?: number) {
      const amount = amountCents || this.settings.startingBankroll
      this.bankroll.balance = amount
      this.bankroll.initialBalance = amount
      this.bankroll.peakBalance = amount
      this.phase = 'WAITING'
    },

    /**
     * Apply a side-game result (gauntlet item, jackpot spin) to the balance.
     * Deliberately NOT counted as totalReturned — side games are tracked in
     * sideGameNet so the crash-game RTP stats stay honest.
     */
    applySideGameDelta(amountCents: number) {
      const applied = amountCents < 0
        ? -Math.min(-amountCents, this.bankroll.balance)
        : amountCents
      this.bankroll.balance += applied
      this.bankroll.sideGameNet += applied
      if (this.bankroll.balance > this.bankroll.peakBalance) {
        this.bankroll.peakBalance = this.bankroll.balance
      }
      // Collections are occasional, so persist immediately — a reload
      // mid-round must not roll collected items or spin results back.
      this.saveToLocalStorage()
    },

    // End a jackpot spin: unfreeze round time and persist the shifted clock,
    // so a reload after the spin resolves the round on the frozen timeline
    // rather than one where the freeze never happened.
    endJackpotSpin() {
      this.jackpotSpinActive = false
      this.saveToLocalStorage()
    },

    updateSettings(partial: Partial<GameSettings>) {
      Object.assign(this.settings, partial)
    },

    saveToLocalStorage() {
      try {
        // The real phase and the in-flight round are persisted: elapsed time
        // derives from currentRound.startedAt (wall clock), so a reload can
        // resolve exactly what happened while the app was closed. Closing the
        // tab is never an undo.
        const data = {
          version: STORAGE_VERSION,
          settings: this.settings,
          bankroll: this.bankroll,
          roundHistory: this.roundHistory,
          nextRoundId: this.nextRoundId,
          pendingBet: this.pendingBet,
          phase: this.phase,
          currentRound: this.currentRound
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // localStorage may be full or unavailable
      }
    },

    loadFromLocalStorage(): boolean {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return false

        const data = JSON.parse(raw)
        if (!data || typeof data !== 'object') return false

        this.settings = sanitizeSettings(data.settings)
        this.bankroll = sanitizeBankroll(data.bankroll)
        this.roundHistory = Array.isArray(data.roundHistory)
          ? data.roundHistory.filter((r: unknown) =>
              r && typeof r === 'object' && Number.isFinite((r as RoundRecord).crashPoint))
          : []

        // v1 payloads predate nextRoundId — derive it from history
        const maxHistoryId = this.roundHistory.reduce((max, r) => Math.max(max, r.id), 0)
        this.nextRoundId = asFiniteNumber(data.nextRoundId, maxHistoryId + 1)

        this.pendingBet = asFiniteNumber(data.pendingBet, 1000)
        this.phase = GAME_PHASES.includes(data.phase) ? data.phase : 'WAITING'
        this.currentRound = sanitizeRound(data.currentRound)

        // An in-flight phase without a resolvable round (v2 payloads, corrupt
        // data) can't continue — park at the betting screen.
        if (!this.currentRound && (this.phase === 'RUNNING' || this.phase === 'CRASHED' || this.phase === 'SETTLING')) {
          this.phase = 'WAITING'
        }

        this.jackpotSpinActive = false
        return true
      } catch {
        return false
      }
    },

    clearSession() {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
      this.$reset()
    }
  }
})
