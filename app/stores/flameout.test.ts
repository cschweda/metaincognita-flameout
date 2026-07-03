import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { GameMode } from '~/types/flameout'
import { useFlameoutStore } from './flameout'

function freshStore() {
  setActivePinia(createPinia())
  const store = useFlameoutStore()
  store.initializeGame({ houseEdgePercent: 3, startingBankroll: 1000, speedFactor: 1, gameMode: 'classic' })
  return store
}

function playRound(store: ReturnType<typeof useFlameoutStore>, opts: { bet?: number, cashoutAt?: number | null } = {}) {
  const { bet = 100, cashoutAt = null } = opts
  store.startRound(2.0)
  store.placeBet(bet)
  if (cashoutAt !== null) store.cashOut(cashoutAt)
  store.settleRound()
}

describe('flameout store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('round ids', () => {
    it('assigns monotonically increasing ids', () => {
      const store = freshStore()
      playRound(store)
      playRound(store)
      playRound(store)
      expect(store.roundHistory.map(r => r.id)).toEqual([1, 2, 3])
    })

    it('does not reuse ids after the 1000-round history trim', () => {
      const store = freshStore()
      store.bankroll.balance = 10_000_000
      for (let i = 0; i < 1005; i++) {
        playRound(store, { bet: 10, cashoutAt: 1.5 })
      }
      expect(store.roundHistory.length).toBe(1000)
      const ids = store.roundHistory.map(r => r.id)
      expect(new Set(ids).size).toBe(1000)
      expect(ids[ids.length - 1]).toBe(1005)
    })
  })

  describe('side game accounting', () => {
    it('keeps side-game results out of totalReturned and empirical RTP', () => {
      const store = freshStore()
      store.startRound(2.0)
      store.placeBet(100)
      store.applySideGameDelta(5000)
      store.settleRound()

      expect(store.bankroll.sideGameNet).toBe(5000)
      expect(store.bankroll.totalReturned).toBe(0)
      expect(store.empiricalRTP).toBe(0)
      // Balance still moved: 100000 - 100 bet + 5000 bonus
      expect(store.bankroll.balance).toBe(104_900)
    })

    it('never drives the balance below zero on penalties', () => {
      const store = freshStore()
      store.bankroll.balance = 300
      store.applySideGameDelta(-5000)
      expect(store.bankroll.balance).toBe(0)
      expect(store.bankroll.sideGameNet).toBe(-300)
    })
  })

  describe('cashout guards', () => {
    it('blocks cashout while a jackpot spin is active', () => {
      const store = freshStore()
      store.startRound(5.0)
      store.placeBet(100)
      store.setPhase('RUNNING')
      expect(store.canCashOut).toBe(true)
      store.jackpotSpinActive = true
      expect(store.canCashOut).toBe(false)
    })
  })

  describe('round timing', () => {
    it('shiftRoundStart pushes the start timestamp forward (freezes elapsed)', () => {
      const store = freshStore()
      store.startRound(2.0)
      const before = store.currentRound!.startedAt
      store.shiftRoundStart(1234)
      expect(store.currentRound!.startedAt).toBe(before + 1234)
    })
  })

  describe('persistence', () => {
    it('round-trips a session through localStorage', () => {
      const store = freshStore()
      playRound(store, { bet: 200, cashoutAt: 1.8 })
      store.applySideGameDelta(700)
      store.saveToLocalStorage()

      const reloaded = useFlameoutStore(createPinia())
      expect(reloaded.loadFromLocalStorage()).toBe(true)
      expect(reloaded.roundHistory.length).toBe(1)
      expect(reloaded.bankroll.sideGameNet).toBe(700)
      expect(reloaded.nextRoundId).toBe(2)
      expect(reloaded.currentRound).toBeNull()
    })

    it('migrates v1 payloads (no version, sideGameNet, or nextRoundId)', () => {
      const v1 = {
        settings: { houseEdgePercent: 5, startingBankroll: 50_000, speedFactor: 2, gameMode: 'classic' },
        bankroll: {
          balance: 42_000,
          initialBalance: 50_000,
          peakBalance: 51_000,
          totalWagered: 9000,
          totalReturned: 1000,
          roundsPlayed: 9,
          roundsWon: 2,
          roundsLost: 7,
          currentStreak: -3,
          longestWinStreak: 2,
          longestLossStreak: 4
        },
        roundHistory: [
          { id: 8, crashPoint: 1.5, bet: 100, cashoutMultiplier: null, payout: 0, profit: -100, balanceAfter: 42_100, timestamp: 1 },
          { id: 9, crashPoint: 2.5, bet: 100, cashoutMultiplier: 2.0, payout: 200, profit: 100, balanceAfter: 42_000, timestamp: 2 }
        ],
        pendingBet: 500,
        phase: 'WAITING'
      }
      localStorage.setItem('flameout-session', JSON.stringify(v1))

      setActivePinia(createPinia())
      const store = useFlameoutStore()
      expect(store.loadFromLocalStorage()).toBe(true)
      expect(store.bankroll.balance).toBe(42_000)
      expect(store.bankroll.sideGameNet).toBe(0)
      expect(store.nextRoundId).toBe(10)
      expect(store.settings.houseEdgePercent).toBe(5)
    })

    it('rejects corrupt payloads without poisoning state', () => {
      localStorage.setItem('flameout-session', '{"bankroll": "not an object"')
      setActivePinia(createPinia())
      const store = useFlameoutStore()
      expect(store.loadFromLocalStorage()).toBe(false)
      expect(store.phase).toBe('SETUP')
    })

    it('persists and restores an in-flight round with its phase', () => {
      const store = freshStore()
      store.startRound(2.5)
      store.placeBet(500)
      store.setPhase('RUNNING')
      store.saveToLocalStorage()

      setActivePinia(createPinia())
      const reloaded = useFlameoutStore()
      expect(reloaded.loadFromLocalStorage()).toBe(true)
      expect(reloaded.phase).toBe('RUNNING')
      expect(reloaded.currentRound).not.toBeNull()
      expect(reloaded.currentRound!.crashPoint).toBe(2.5)
      expect(reloaded.currentRound!.betAmount).toBe(500)
      expect(reloaded.currentRound!.startedAt).toBe(store.currentRound!.startedAt)
    })

    it('parks at WAITING when an in-flight phase has no usable round', () => {
      const payload = {
        version: 3,
        settings: {},
        bankroll: {},
        roundHistory: [],
        pendingBet: 1000,
        phase: 'RUNNING',
        currentRound: { crashPoint: 'corrupt' }
      }
      localStorage.setItem('flameout-session', JSON.stringify(payload))
      setActivePinia(createPinia())
      const store = useFlameoutStore()
      expect(store.loadFromLocalStorage()).toBe(true)
      expect(store.phase).toBe('WAITING')
      expect(store.currentRound).toBeNull()
    })

    it('initializeGame persists the fresh session immediately', () => {
      setActivePinia(createPinia())
      const store = useFlameoutStore()
      store.initializeGame({ houseEdgePercent: 3, startingBankroll: 1000, speedFactor: 1, gameMode: 'classic' })

      setActivePinia(createPinia())
      const reloaded = useFlameoutStore()
      expect(reloaded.loadFromLocalStorage()).toBe(true)
      expect(reloaded.phase).toBe('WAITING')
      expect(reloaded.bankroll.balance).toBe(100_000)
    })

    it('coerces non-numeric bankroll fields to safe defaults', () => {
      const payload = {
        version: 2,
        settings: {},
        bankroll: { balance: 'NaN-city', totalWagered: null },
        roundHistory: [],
        pendingBet: 1000,
        phase: 'WAITING'
      }
      localStorage.setItem('flameout-session', JSON.stringify(payload))
      setActivePinia(createPinia())
      const store = useFlameoutStore()
      expect(store.loadFromLocalStorage()).toBe(true)
      expect(store.bankroll.balance).toBe(0)
      expect(store.bankroll.totalWagered).toBe(0)
      expect(store.empiricalRTP).toBe(0)
    })
  })

  describe('setup validation', () => {
    it('clamps out-of-range setup values to safe bounds', () => {
      setActivePinia(createPinia())
      const store = useFlameoutStore()
      store.initializeGame({
        houseEdgePercent: -5,
        startingBankroll: 0,
        speedFactor: 99,
        gameMode: 'nonsense' as GameMode
      })
      expect(store.settings.houseEdgePercent).toBe(0.5)
      expect(store.settings.startingBankroll).toBe(100) // $1 floor, in cents
      expect(store.settings.speedFactor).toBe(10)
      expect(store.settings.gameMode).toBe('classic')
    })

    it('falls back to defaults for non-numeric setup values', () => {
      setActivePinia(createPinia())
      const store = useFlameoutStore()
      store.initializeGame({
        houseEdgePercent: Number.NaN,
        startingBankroll: Number.NaN,
        speedFactor: Number.NaN,
        gameMode: 'classic'
      })
      expect(store.settings.houseEdgePercent).toBe(3)
      expect(store.settings.startingBankroll).toBe(100_000) // $1,000 default
      expect(store.settings.speedFactor).toBe(1)
    })
  })

  describe('streak bookkeeping', () => {
    it('flips streaks correctly across wins and losses', () => {
      const store = freshStore()
      playRound(store, { cashoutAt: null })
      playRound(store, { cashoutAt: null })
      expect(store.bankroll.currentStreak).toBe(-2)
      playRound(store, { cashoutAt: 1.5 })
      expect(store.bankroll.currentStreak).toBe(1)
      expect(store.bankroll.longestLossStreak).toBe(2)
    })
  })
})
