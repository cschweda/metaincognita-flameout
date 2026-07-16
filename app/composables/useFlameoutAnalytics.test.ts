import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { RoundRecord } from '~/types/flameout'
import { useFlameoutStore } from '~/stores/flameout'
import { useFlameoutAnalytics } from './useFlameoutAnalytics'

function freshStore() {
  setActivePinia(createPinia())
  const store = useFlameoutStore()
  store.initializeGame({ houseEdgePercent: 3, startingBankroll: 1000, speedFactor: 1, gameMode: 'classic' })
  return store
}

function playRound(store: ReturnType<typeof useFlameoutStore>, crashPoint: number, instant: boolean) {
  store.startRound(crashPoint, instant)
  store.placeBet(100)
  store.settleRound()
}

describe('instantCrashRate', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('counts the house-edge flag, not every displayed 1.00×', () => {
    const store = freshStore()
    const analytics = useFlameoutAnalytics()

    playRound(store, 1.00, true) // forced instant (the edge mechanism)
    playRound(store, 1.00, false) // organic crash floored down to 1.00×
    playRound(store, 2.50, false) // ordinary round

    // Only the forced instant counts — this is the number that converges to
    // the house edge; displayed 1.00× converges to 1 - rtp/1.01 instead.
    expect(analytics.instantCrashRate.value).toBeCloseTo(1 / 3, 10)
  })

  it('falls back to crashPoint === 1.00 for legacy records without the flag', () => {
    const store = freshStore()
    const analytics = useFlameoutAnalytics()

    const legacy = (id: number, crashPoint: number): RoundRecord => ({
      id,
      crashPoint,
      bet: 100,
      cashoutMultiplier: null,
      payout: 0,
      profit: -100,
      balanceAfter: 900,
      timestamp: id
    })
    store.roundHistory = [legacy(1, 1.00), legacy(2, 3.00)]

    expect(analytics.instantCrashRate.value).toBeCloseTo(0.5, 10)
  })
})
