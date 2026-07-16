import { useFlameoutStore } from '~/stores/flameout'
import { generateCrashPoint, currentMultiplier, timeToMultiplier } from '~/utils/flameout-math'
import type { GamePhase } from '~/types/flameout'

/**
 * Round driver for the crash game.
 *
 * State is module-scoped: every component that calls useFlameoutEngine()
 * shares the same loop and timers, so cleanup() cancels work scheduled from
 * anywhere (game page, controls, layout).
 *
 * Time is derived from currentRound.startedAt (wall clock), not from an
 * accumulator owned by the animation loop. A round therefore keeps "flowing"
 * while the page is unmounted, and resumeFromInterruption() can resolve
 * exactly what happened in the meantime — there is no way to freeze a round
 * mid-flight and cash out risk-free.
 */

let animationFrameId: number | null = null
let settleTimerId: ReturnType<typeof setTimeout> | null = null
let nextRoundTimerId: ReturnType<typeof setTimeout> | null = null
let lastTickPerf = 0

export function useFlameoutEngine() {
  const store = useFlameoutStore()

  function startBettingPhase() {
    store.setPhase('WAITING')

    // Pre-generate crash point
    const { crashPoint, instant } = generateCrashPoint(store.settings.houseEdgePercent)
    store.startRound(crashPoint, instant)

    // Auto-place bet and start immediately — but only if the bet is actually
    // accepted. A rejected bet (cleared input, over max, over balance) must
    // park at the betting screen, not launch a betless flight that auto-bet
    // would then loop forever.
    if (store.settings.autoBet && store.placeBet(store.pendingBet)) {
      startRunningPhase()
      return
    }

    // Otherwise wait for the player — the round starts on "Place Bet".
  }

  function placeBetAndStart(amountCents: number) {
    if (store.phase !== 'WAITING') return false
    // A rejected bet must not start the round — nothing would be at stake.
    if (!store.placeBet(amountCents)) return false
    startRunningPhase()
    return true
  }

  function startRunningPhase() {
    if (!store.currentRound) return

    store.setPhase('RUNNING')
    store.beginRun()
    // Persist the live round: a reload or closed tab resolves it from the
    // wall clock instead of silently rolling the bet back.
    store.saveToLocalStorage()
    lastTickPerf = performance.now()
    stopAnimation()
    tick()
  }

  function tick() {
    if (store.phase !== 'RUNNING' || !store.currentRound) {
      stopAnimation()
      return
    }

    const nowPerf = performance.now()
    const dt = nowPerf - lastTickPerf
    lastTickPerf = nowPerf

    // Jackpot spin: freeze round time by pushing the start timestamp forward.
    // The multiplier holds, so a spin can never carry the round past its
    // crash point (and cashout is blocked by the store while spinning).
    if (store.jackpotSpinActive) {
      store.shiftRoundStart(dt)
    }

    const elapsed = Date.now() - store.currentRound.startedAt
    const multiplier = currentMultiplier(elapsed, store.settings.speedFactor)

    // Auto-cashout resolves before the crash check so a large frame gap
    // (background tab) can't turn a target that was reached first in game
    // time into a loss — mirrors resumeFromInterruption. It pays exactly
    // the target, not the frame's overshoot. An exact tie (target equals the
    // crash point) WINS: P(win at m) must equal P(crash >= m) = rtp/m, or the
    // advertised RTP and the Strategy Lab's numbers quietly stop matching
    // live play (tie-loses adds ~0.5pp of hidden edge at a 2× target).
    const target = store.settings.autoCashoutTarget
    if (
      target
      && !store.currentRound.cashedOut
      && store.currentRound.betAmount > 0
      && multiplier >= target
      && target <= store.currentRound.crashPoint
      && !store.jackpotSpinActive
    ) {
      store.updateMultiplier(target, Math.round(timeToMultiplier(target, store.settings.speedFactor)))
      cashOut(target)
      return
    }

    store.updateMultiplier(multiplier, elapsed)

    if (multiplier >= store.currentRound.crashPoint && !store.jackpotSpinActive) {
      crash()
      return
    }

    animationFrameId = requestAnimationFrame(tick)
  }

  function cashOut(atMultiplier?: number): boolean {
    if (!store.canCashOut || !store.currentRound) return false

    const multiplier = atMultiplier ?? store.currentRound.currentMultiplier
    store.cashOut(multiplier)

    // Stop the round immediately — don't keep running to the crash
    stopAnimation()
    store.setPhase('CRASHED') // reuse CRASHED phase to show result
    store.saveToLocalStorage() // the credited win survives a closed tab
    scheduleSettle()

    return true
  }

  function crash() {
    if (!store.currentRound) return

    const crashElapsed = Math.round(timeToMultiplier(store.currentRound.crashPoint, store.settings.speedFactor))
    store.updateMultiplier(store.currentRound.crashPoint, crashElapsed)
    store.setPhase('CRASHED')
    stopAnimation()
    scheduleSettle()
  }

  function scheduleSettle(delayMs = 1500) {
    if (settleTimerId) clearTimeout(settleTimerId)
    settleTimerId = setTimeout(() => {
      settleTimerId = null
      settle()
    }, delayMs)
  }

  function settle(startNext = true) {
    // The session may have been ended (New Game / Leave) while settling
    if (store.phase === 'SETUP' || store.phase === 'BUSTED') return

    store.setPhase('SETTLING')
    store.settleRound()
    store.saveToLocalStorage()

    // settleRound() may flip the phase to BUSTED (TS can't see the mutation)
    if ((store.phase as GamePhase) === 'BUSTED') return

    if (!startNext) {
      // Resolved from outside the game page: park at the betting screen
      // without staging the next round — the game page stages one on mount.
      store.setPhase('WAITING')
      store.saveToLocalStorage()
      return
    }

    // Auto-start next round after brief pause
    if (nextRoundTimerId) clearTimeout(nextRoundTimerId)
    nextRoundTimerId = setTimeout(() => {
      nextRoundTimerId = null
      if (store.phase !== 'BUSTED' && store.phase !== 'SETUP') {
        startBettingPhase()
      }
    }, 500)
  }

  /**
   * Re-enter a session after the game page was unmounted (navigation away)
   * or reloaded mid-round. Resolves whatever happened while the loop was
   * down, in game-time order: auto-cashout first if its target was reached
   * before the crash point, then the crash itself, else resume ticking.
   */
  function resumeFromInterruption() {
    // Any canvas-local spin state died with the component
    store.jackpotSpinActive = false

    if (store.phase === 'SETTLING') {
      // Settle was interrupted — finish it now
      stopAnimation()
      store.setPhase('CRASHED')
      scheduleSettle(300)
      return
    }

    if (store.phase === 'CRASHED') {
      // Interrupted during the result pause — give it a short beat, then settle
      scheduleSettle(800)
      return
    }

    if (store.phase !== 'RUNNING' || !store.currentRound) return

    const round = store.currentRound
    const speed = store.settings.speedFactor
    const elapsed = Date.now() - round.startedAt
    const crashMs = timeToMultiplier(round.crashPoint, speed)
    const target = store.settings.autoCashoutTarget
    const hasLiveBet = round.betAmount > 0 && !round.cashedOut

    if (hasLiveBet && target && target <= round.crashPoint && elapsed >= timeToMultiplier(target, speed)) {
      store.updateMultiplier(target, Math.round(timeToMultiplier(target, speed)))
      cashOut(target)
      return
    }

    if (elapsed >= crashMs) {
      crash()
      return
    }

    lastTickPerf = performance.now()
    stopAnimation()
    tick()
  }

  /**
   * Resolve an interrupted session from OUTSIDE the game page — the History,
   * Analysis, and setup pages call this on mount so their numbers include a
   * round that crashed or auto-cashed while no loop was running. Unlike
   * resumeFromInterruption it never resumes ticking and never starts the next
   * round; a round that is genuinely still in flight is left alone.
   */
  function resolveInterrupted() {
    store.jackpotSpinActive = false

    if (store.phase === 'CRASHED' || store.phase === 'SETTLING') {
      stopAnimation()
      settle(false)
      return
    }

    if (store.phase !== 'RUNNING' || !store.currentRound) return

    const round = store.currentRound
    const speed = store.settings.speedFactor
    const elapsed = Date.now() - round.startedAt
    const crashMs = timeToMultiplier(round.crashPoint, speed)
    const target = store.settings.autoCashoutTarget
    const hasLiveBet = round.betAmount > 0 && !round.cashedOut

    if (hasLiveBet && target && target <= round.crashPoint && elapsed >= timeToMultiplier(target, speed)) {
      store.updateMultiplier(target, Math.round(timeToMultiplier(target, speed)))
      store.cashOut(target)
      settle(false)
      return
    }

    if (elapsed >= crashMs) {
      store.updateMultiplier(round.crashPoint, Math.round(crashMs))
      settle(false)
    }

    // Otherwise the round is still in flight — leave it for the game page.
  }

  function stopAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  function rebuy() {
    store.rebuy()
    startBettingPhase()
  }

  /** Cancel the loop and every pending timer — nothing survives unmount. */
  function cleanup() {
    stopAnimation()
    if (settleTimerId) {
      clearTimeout(settleTimerId)
      settleTimerId = null
    }
    if (nextRoundTimerId) {
      clearTimeout(nextRoundTimerId)
      nextRoundTimerId = null
    }
  }

  return {
    startBettingPhase,
    placeBetAndStart,
    cashOut,
    rebuy,
    resumeFromInterruption,
    resolveInterrupted,
    cleanup
  }
}
