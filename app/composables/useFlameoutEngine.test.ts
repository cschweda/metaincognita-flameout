import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFlameoutStore } from '~/stores/flameout'
import { timeToMultiplier } from '~/utils/flameout-math'
import { useFlameoutEngine } from './useFlameoutEngine'

/**
 * Drives the engine with faked rAF + Date so wall-clock scenarios
 * (frame gaps, background tabs, closed tabs) are reproducible.
 */

function elapsedFor(multiplier: number): number {
  return Math.ceil(timeToMultiplier(multiplier, 1))
}

describe('useFlameoutEngine', () => {
  let store: ReturnType<typeof useFlameoutStore>
  let engine: ReturnType<typeof useFlameoutEngine>

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    })
    localStorage.clear()
    setActivePinia(createPinia())
    store = useFlameoutStore()
    store.initializeGame({ houseEdgePercent: 3, startingBankroll: 1000, speedFactor: 1, gameMode: 'classic' })
    engine = useFlameoutEngine()
  })

  afterEach(() => {
    engine.cleanup()
    vi.useRealTimers()
  })

  function startRoundWithBet(crashPoint: number, bet = 1000) {
    store.startRound(crashPoint)
    engine.placeBetAndStart(bet)
  }

  describe('auto-cashout', () => {
    it('pays exactly the target when a frame lands past it', () => {
      store.updateSettings({ autoCashoutTarget: 2 })
      startRoundWithBet(10)

      // Next frame arrives late — the multiplier is ~2.5 by then
      vi.setSystemTime(Date.now() + elapsedFor(2.5))
      vi.advanceTimersByTime(16) // fire the single pending frame

      expect(store.currentRound!.cashedOut).toBe(true)
      expect(store.currentRound!.cashoutMultiplier).toBe(2)
      // 1000 bet at exactly 2× → 2000 back, not the frame's overshoot
      expect(store.bankroll.totalReturned).toBe(2000)
    })

    it('wins in game-time order when one frame gap spans both target and crash', () => {
      store.updateSettings({ autoCashoutTarget: 2 })
      startRoundWithBet(3)

      // Background tab: the next frame lands past the crash point too
      vi.setSystemTime(Date.now() + elapsedFor(4.8))
      vi.advanceTimersByTime(16) // fire the single pending frame

      // The target (2×) was reached before the crash (3×) in game time → win
      expect(store.currentRound!.cashedOut).toBe(true)
      expect(store.currentRound!.cashoutMultiplier).toBe(2)
    })

    it('still loses when the target sits at or above the crash point', () => {
      store.updateSettings({ autoCashoutTarget: 3 })
      startRoundWithBet(3)

      vi.setSystemTime(Date.now() + elapsedFor(4.8))
      vi.advanceTimersByTime(16) // fire the single pending frame

      expect(store.currentRound!.cashedOut).toBe(false)
      expect(store.phase).toBe('CRASHED')
      expect(store.currentRound!.currentMultiplier).toBe(3)
    })
  })

  describe('in-flight persistence', () => {
    it('persists the round the moment the bet starts', () => {
      startRoundWithBet(2.5, 700)

      const raw = localStorage.getItem('flameout-session')
      expect(raw).not.toBeNull()
      const saved = JSON.parse(raw!)
      expect(saved.phase).toBe('RUNNING')
      expect(saved.currentRound?.crashPoint).toBe(2.5)
      expect(saved.currentRound?.betAmount).toBe(700)
    })

    it('persists a manual cashout before the round settles', () => {
      startRoundWithBet(10)
      vi.setSystemTime(Date.now() + elapsedFor(1.5))
      vi.advanceTimersByTime(16) // fire the single pending frame
      engine.cashOut()

      const raw = localStorage.getItem('flameout-session')
      expect(raw).not.toBeNull()
      const saved = JSON.parse(raw!)
      expect(saved.phase).toBe('CRASHED')
      expect(saved.currentRound?.cashedOut).toBe(true)
    })

    it('resolves a crash that happened while the app was closed', () => {
      startRoundWithBet(1.5, 1000)
      const balanceAfterBet = store.bankroll.balance
      engine.cleanup() // tab closed — loop and timers die with it

      // Fresh app start: new pinia, state restored from localStorage,
      // and the crash point has long passed in wall-clock time.
      setActivePinia(createPinia())
      const reloaded = useFlameoutStore()
      expect(reloaded.loadFromLocalStorage()).toBe(true)
      expect(reloaded.phase).toBe('RUNNING')

      vi.setSystemTime(Date.now() + elapsedFor(1.5) + 5000)
      const resumedEngine = useFlameoutEngine()
      resumedEngine.resumeFromInterruption()
      vi.advanceTimersByTime(1600) // settle timer

      // The loss is recorded — closing the tab cannot roll it back
      expect(reloaded.roundHistory.length).toBe(1)
      expect(reloaded.roundHistory[0]!.profit).toBe(-1000)
      expect(reloaded.bankroll.balance).toBe(balanceAfterBet)
    })
  })
})
