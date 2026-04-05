import { defineStore } from 'pinia'
import type {
  GamePhase,
  GameSettings,
  BankrollState,
  RoundRecord,
  CurrentRound,
  SetupConfig
} from '~/types/flameout'
import { DEFAULT_SETTINGS, dollarsToCents } from '~/types/flameout'

const STORAGE_KEY = 'flameout-session'

export const useFlameoutStore = defineStore('flameout', {
  state: () => ({
    phase: 'SETUP' as GamePhase,

    settings: { ...DEFAULT_SETTINGS } as GameSettings,

    bankroll: {
      balance: 0,
      initialBalance: 0,
      peakBalance: 0,
      totalWagered: 0,
      totalReturned: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      roundsLost: 0,
      currentStreak: 0,
      longestWinStreak: 0,
      longestLossStreak: 0
    } as BankrollState,

    currentRound: null as CurrentRound | null,

    roundHistory: [] as RoundRecord[],

    // Current bet input (cents)
    pendingBet: 1000, // $10.00 default

    // UI state
    selectedChipValue: 1000
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
    },

    chipDenominations: (state): number[] => {
      const min = state.settings.minBet
      if (min >= 10000) return [10000, 25000, 50000, 100000]
      if (min >= 1000) return [1000, 5000, 10000, 50000]
      if (min >= 100) return [100, 500, 1000, 5000]
      return [10, 50, 100, 500]
    }
  },

  actions: {
    initializeGame(config: SetupConfig) {
      const bankrollCents = dollarsToCents(config.startingBankroll)

      this.settings = {
        ...DEFAULT_SETTINGS,
        houseEdgePercent: config.houseEdgePercent,
        startingBankroll: bankrollCents,
        speedFactor: config.speedFactor
      }

      this.bankroll = {
        balance: bankrollCents,
        initialBalance: bankrollCents,
        peakBalance: bankrollCents,
        totalWagered: 0,
        totalReturned: 0,
        roundsPlayed: 0,
        roundsWon: 0,
        roundsLost: 0,
        currentStreak: 0,
        longestWinStreak: 0,
        longestLossStreak: 0
      }

      this.currentRound = null
      this.roundHistory = []
      this.pendingBet = Math.min(1000, bankrollCents)
      this.phase = 'WAITING'
    },

    setPhase(phase: GamePhase) {
      this.phase = phase
    },

    startRound(crashPoint: number) {
      this.currentRound = {
        crashPoint,
        currentMultiplier: 1.00,
        betAmount: 0,
        startedAt: Date.now(),
        elapsedMs: 0,
        cashedOut: false,
        cashoutMultiplier: null
      }
    },

    placeBet(amount: number) {
      if (!this.currentRound) return
      if (amount > this.bankroll.balance) return
      if (amount < this.settings.minBet) return
      if (amount > this.settings.maxBet) return

      this.currentRound.betAmount = amount
      this.bankroll.balance -= amount
      this.bankroll.totalWagered += amount
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

      const round = this.currentRound
      const won = round.cashedOut
      const payout = won ? Math.floor(round.betAmount * (round.cashoutMultiplier || 0)) : 0
      const profit = payout - round.betAmount

      const record: RoundRecord = {
        id: this.roundHistory.length + 1,
        crashPoint: round.crashPoint,
        bet: round.betAmount,
        cashoutMultiplier: round.cashoutMultiplier,
        payout,
        profit,
        balanceAfter: this.bankroll.balance,
        timestamp: Date.now()
      }

      this.roundHistory.push(record)

      // Only count rounds where a bet was placed
      if (round.betAmount > 0) {
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

    updateSettings(partial: Partial<GameSettings>) {
      Object.assign(this.settings, partial)
    },

    saveToLocalStorage() {
      try {
        const data = {
          settings: this.settings,
          bankroll: this.bankroll,
          roundHistory: this.roundHistory,
          pendingBet: this.pendingBet,
          phase: this.phase === 'RUNNING' || this.phase === 'CRASHED' || this.phase === 'SETTLING'
            ? 'WAITING'
            : this.phase
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
        this.settings = { ...DEFAULT_SETTINGS, ...data.settings }
        this.bankroll = data.bankroll
        this.roundHistory = data.roundHistory || []
        this.pendingBet = data.pendingBet || 1000
        this.phase = data.phase || 'WAITING'
        this.currentRound = null
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
