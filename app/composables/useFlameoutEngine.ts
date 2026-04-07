import { ref, computed } from 'vue'
import { useFlameoutStore } from '~/stores/flameout'
import { generateCrashPoint, currentMultiplier } from '~/utils/flameout-math'

export function useFlameoutEngine() {
  const store = useFlameoutStore()

  const animationFrameId = ref<number | null>(null)
  const roundStartTime = ref<number>(0)
  const bettingTimerId = ref<ReturnType<typeof setTimeout> | null>(null)

  const isAnimating = computed(() => animationFrameId.value !== null)

  function startBettingPhase() {
    store.setPhase('WAITING')

    // Pre-generate crash point
    const crashPoint = generateCrashPoint(store.settings.houseEdgePercent)
    store.startRound(crashPoint)

    // Auto-place bet and start immediately if auto-bet is enabled
    if (store.settings.autoBet && store.pendingBet <= store.bankroll.balance) {
      placeBet(store.pendingBet)
      startRunningPhase()
      return
    }

    // Otherwise wait for the player to manually place a bet — no timeout loop.
    // The round starts when the player clicks "Place Bet".
  }

  function placeBet(amountCents: number) {
    if (store.phase !== 'WAITING') return false
    store.placeBet(amountCents)
    return true
  }

  function placeBetAndStart(amountCents: number) {
    if (store.phase !== 'WAITING') return false
    store.placeBet(amountCents)

    // Clear betting timer and start immediately
    if (bettingTimerId.value) {
      clearTimeout(bettingTimerId.value)
      bettingTimerId.value = null
    }

    startRunningPhase()
    return true
  }

  function startRunningPhase() {
    if (!store.currentRound) return

    store.setPhase('RUNNING')
    roundStartTime.value = performance.now()

    // Start animation loop
    tick()
  }

  function tick() {
    if (store.phase !== 'RUNNING' || !store.currentRound) {
      stopAnimation()
      return
    }

    const elapsed = performance.now() - roundStartTime.value
    const multiplier = currentMultiplier(elapsed, store.settings.speedFactor)

    store.updateMultiplier(multiplier, elapsed)

    // Check auto-cashout (suspended during jackpot spin)
    if (
      store.settings.autoCashoutTarget
      && !store.currentRound.cashedOut
      && multiplier >= store.settings.autoCashoutTarget
      && store.currentRound.betAmount > 0
      && !store.jackpotSpinActive
    ) {
      cashOut()
    }

    // Check crash (suspended during jackpot spin)
    if (multiplier >= store.currentRound.crashPoint && !store.jackpotSpinActive) {
      crash()
      return
    }

    animationFrameId.value = requestAnimationFrame(tick)
  }

  function cashOut(): boolean {
    if (!store.canCashOut || !store.currentRound) return false

    const multiplier = store.currentRound.currentMultiplier
    store.cashOut(multiplier)

    // Stop the round immediately — don't keep running to the crash
    stopAnimation()
    store.setPhase('CRASHED') // reuse CRASHED phase to show result

    // Settle after a brief pause to show the cashout result
    setTimeout(() => {
      settle()
    }, 1500)

    return true
  }

  function crash() {
    if (!store.currentRound) return

    store.updateMultiplier(store.currentRound.crashPoint, store.currentRound.elapsedMs)
    store.setPhase('CRASHED')
    stopAnimation()

    // Settle after a brief pause
    setTimeout(() => {
      settle()
    }, 1500)
  }

  function settle() {
    store.setPhase('SETTLING')
    store.settleRound()
    store.saveToLocalStorage()

    // Check bust
    if (store.phase === 'BUSTED') return

    // Auto-start next round after brief pause
    setTimeout(() => {
      if (store.phase !== 'BUSTED' && store.phase !== 'SETUP') {
        startBettingPhase()
      }
    }, 500)
  }

  function stopAnimation() {
    if (animationFrameId.value !== null) {
      cancelAnimationFrame(animationFrameId.value)
      animationFrameId.value = null
    }
  }

  function stopGame() {
    stopAnimation()
    if (bettingTimerId.value) {
      clearTimeout(bettingTimerId.value)
      bettingTimerId.value = null
    }
    store.saveToLocalStorage()
    store.setPhase('SETUP')
  }

  function rebuy() {
    store.rebuy()
    startBettingPhase()
  }

  function cleanup() {
    stopAnimation()
    if (bettingTimerId.value) {
      clearTimeout(bettingTimerId.value)
      bettingTimerId.value = null
    }
  }

  return {
    isAnimating,
    startBettingPhase,
    placeBet,
    placeBetAndStart,
    cashOut,
    stopGame,
    rebuy,
    cleanup
  }
}
