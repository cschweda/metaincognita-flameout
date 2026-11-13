<script setup lang="ts">
import { formatCents, formatMultiplier } from '~/types/flameout'
import type { GameMode } from '~/types/flameout'
import { isEditableTarget } from '~/utils/keyboard'

const route = useRoute()
const router = useRouter()
const store = useFlameoutStore()
const engine = useFlameoutEngine()

// Keyboard: space to bet/cashout — but never while typing in a field
function handleKeydown(e: KeyboardEvent) {
  // Key repeat would place a bet and instantly cash out at ~1.00×
  if (e.repeat) return
  if (isEditableTarget(e.target)) return
  if (e.code === 'Space') {
    e.preventDefault()
    if (store.heldByOtherTab) return
    // Same gate as the Place Bet button — an invalid bet must not reach the
    // engine (placeBetAndStart also refuses, this just keeps them in sync)
    if (store.phase === 'WAITING' && store.canPlaceBet) {
      engine.placeBetAndStart(store.pendingBet)
    } else if (store.canCashOut) {
      engine.cashOut()
    }
  }
}

function enterSession() {
  // A ?demo link starts a throwaway session — but only when there is nothing
  // to throw away. initializeGame() persists immediately, so without the load
  // check any link carrying ?demo silently replaced a saved session.
  const demo = route.query.demo as string | undefined
  if (demo && !store.isPlaying && !store.loadFromLocalStorage()) {
    // Auto-start a demo session
    const mode = (route.query.mode as GameMode) || 'classic'
    store.initializeGame({
      houseEdgePercent: 3,
      startingBankroll: 1000,
      speedFactor: 1,
      gameMode: mode
    })
    store.pendingBet = 1000
    engine.startBettingPhase()
    engine.placeBetAndStart(1000)
    return
  }

  if (!store.isPlaying) {
    const loaded = store.loadFromLocalStorage()
    if (!loaded || !store.isPlaying) {
      router.replace('/')
      return
    }
  }

  // A round may have been interrupted by navigating away — resolve whatever
  // happened while the loop was down (crash, auto-cashout) and continue.
  if (store.phase === 'RUNNING' || store.phase === 'CRASHED' || store.phase === 'SETTLING') {
    engine.resumeFromInterruption()
    return
  }

  // Open the betting screen. With auto-bet on this places the bet straight
  // away, so coming back to the game resumes the loop instead of waiting for
  // a click the player already opted out of.
  if (store.phase === 'WAITING') {
    engine.startBettingPhase()
  }
}

// Another tab took the session (see the storage listener in the layout).
// Picking this tab back up re-reads what that tab saved and resolves any
// round that played out in the meantime — exactly like a fresh page load.
function continueHere() {
  store.heldByOtherTab = false
  if (!store.loadFromLocalStorage() || !store.isPlaying) {
    router.replace('/')
    return
  }
  enterSession()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  store.heldByOtherTab = false
  enterSession()
})

onUnmounted(() => {
  engine.cleanup()
  window.removeEventListener('keydown', handleKeydown)
})

const showSidebar = ref(true)
const showNewGameConfirm = ref(false)

function confirmNewGame() {
  showNewGameConfirm.value = false
  engine.cleanup()
  store.clearSession()
  router.replace('/')
}

const didCashOut = computed(() => store.currentRound?.cashedOut === true)

const phaseLabel = computed(() => {
  switch (store.phase) {
    case 'WAITING': return 'Place Your Bet'
    case 'RUNNING': return 'LIVE'
    case 'CRASHED':
      if (didCashOut.value) return `Cashed out at ${formatMultiplier(store.currentRound?.cashoutMultiplier || 0)}`
      return `Crashed at ${formatMultiplier(store.currentRound?.crashPoint || 0)}`
    case 'SETTLING': return 'Settling...'
    case 'BUSTED': return 'Busted!'
    default: return ''
  }
})

const phaseBadgeClass = computed(() => {
  switch (store.phase) {
    case 'WAITING': return 'bg-blue-600/80 text-blue-100'
    case 'RUNNING': return 'bg-emerald-600/80 text-emerald-100 motion-safe:animate-pulse'
    case 'CRASHED':
      if (didCashOut.value) return 'bg-emerald-600/80 text-emerald-100'
      return 'bg-red-600/80 text-red-100'
    case 'BUSTED': return 'bg-red-700/80 text-red-100'
    default: return 'bg-neutral-700 text-neutral-300'
  }
})

const multiplierColor = computed(() => {
  const m = store.currentRound?.currentMultiplier || 1
  if (store.phase === 'CRASHED' && didCashOut.value) return 'text-emerald-400'
  if (store.phase === 'CRASHED') return 'text-red-500'
  if (m >= 10) return 'text-red-400'
  if (m >= 5) return 'text-orange-400'
  if (m >= 3) return 'text-amber-400'
  if (m >= 2) return 'text-yellow-400'
  return 'text-emerald-400'
})

// Round results announced to screen readers (the canvas itself is silent)
const liveAnnouncement = computed(() => {
  if (store.phase === 'CRASHED' || store.phase === 'BUSTED') return phaseLabel.value
  if (store.phase === 'WAITING') return 'Place your bet'
  return ''
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <!-- Screen reader announcements for round results -->
    <div
      aria-live="polite"
      class="sr-only"
    >
      {{ liveAnnouncement }}
    </div>

    <!-- Game header -->
    <header class="flex items-center justify-between px-4 py-2 bg-neutral-900/80 border-b border-neutral-800 shrink-0">
      <div class="flex items-center gap-3">
        <span class="text-amber-400 font-bold text-sm">Flameout</span>
        <span class="text-neutral-300 font-mono text-sm">{{ formatCents(store.bankroll.balance) }}</span>
        <span
          class="text-xs font-mono"
          :class="store.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'"
        >
          ({{ store.profitLoss >= 0 ? '+' : '' }}{{ formatCents(store.profitLoss) }})
        </span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-neutral-500 text-xs">Round #{{ store.bankroll.roundsPlayed + 1 }}</span>
        <span class="text-neutral-500 text-xs">{{ store.settings.houseEdgePercent }}% edge</span>
        <button
          class="text-neutral-500 hover:text-neutral-300 transition-colors"
          :aria-label="showSidebar ? 'Hide stats sidebar' : 'Show stats sidebar'"
          @click="showSidebar = !showSidebar"
        >
          <UIcon
            :name="showSidebar ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
            class="w-4 h-4"
          />
        </button>
        <button
          class="text-neutral-500 hover:text-red-400 transition-colors text-xs flex items-center gap-1"
          @click="showNewGameConfirm = true"
        >
          <UIcon
            name="i-lucide-rotate-ccw"
            class="w-3.5 h-3.5"
          />
          New Game
        </button>
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 flex overflow-hidden min-h-0">
      <!-- Left: game area -->
      <div class="flex-1 flex flex-col min-w-0 min-h-0">
        <!-- Phase badge -->
        <div class="flex items-center justify-center py-2 shrink-0">
          <span
            class="px-3 py-1 rounded-full text-xs font-bold"
            :class="phaseBadgeClass"
          >
            {{ phaseLabel }}
          </span>
        </div>

        <!-- Canvas area -->
        <div class="flex-1 flex items-center justify-center px-4 relative min-h-0">
          <FlameoutCanvas />
        </div>

        <!-- Multiplier display -->
        <div class="flex items-center justify-center py-3 shrink-0">
          <div
            v-if="store.phase === 'RUNNING'"
            class="text-center"
          >
            <div
              class="text-5xl font-bold font-mono tabular-nums transition-colors"
              :class="multiplierColor"
            >
              {{ formatMultiplier(store.currentRound?.currentMultiplier || 1) }}
            </div>
          </div>
          <div
            v-else-if="store.phase === 'CRASHED' && didCashOut"
            class="text-center"
          >
            <div class="text-5xl font-bold font-mono tabular-nums text-emerald-400">
              {{ formatMultiplier(store.currentRound?.cashoutMultiplier || 1) }}
            </div>
            <div class="text-emerald-400/80 text-lg font-mono mt-1">
              +{{ formatCents(Math.floor((store.currentRound?.betAmount || 0) * (store.currentRound?.cashoutMultiplier || 0)) - (store.currentRound?.betAmount || 0)) }}
            </div>
          </div>
          <div
            v-else-if="store.phase === 'CRASHED'"
            class="text-center"
          >
            <div class="text-5xl font-bold font-mono tabular-nums text-red-500">
              {{ formatMultiplier(store.currentRound?.crashPoint || 1) }}
            </div>
            <div class="text-red-400/80 text-lg font-mono mt-1">
              -{{ formatCents(store.currentRound?.betAmount || 0) }}
            </div>
          </div>
          <div
            v-else-if="store.phase === 'BUSTED'"
            class="text-center"
          >
            <p class="text-2xl font-bold text-red-500">
              Bankroll Exhausted
            </p>
            <UButton
              color="primary"
              label="Re-buy"
              class="mt-3"
              @click="engine.rebuy()"
            />
          </div>
        </div>

        <!-- Controls -->
        <FlameoutControls />

        <!-- History strip -->
        <FlameoutHistoryStrip />
      </div>

      <!-- How to play overlay (first visit) -->
      <FlameoutHowToPlay />

      <!-- Right: stats sidebar -->
      <aside
        class="border-l border-neutral-800 shrink-0 transition-all duration-300 overflow-hidden"
        :class="showSidebar ? 'w-80' : 'w-0 border-l-0'"
      >
        <FlameoutStats />
      </aside>
    </div>

    <!-- The session moved to another tab — this one waits to be chosen -->
    <UModal
      :open="store.heldByOtherTab"
      :dismissible="false"
      :close="false"
      title="Playing in another tab"
      description="This session was just used in another tab or window, so this one has paused. Continuing here picks up from wherever that tab left off."
    >
      <template #body>
        <div class="flex justify-end">
          <UButton
            color="primary"
            label="Continue here"
            @click="continueHere"
          />
        </div>
      </template>
    </UModal>

    <!-- New game confirmation -->
    <UModal
      v-model:open="showNewGameConfirm"
      title="Start New Game?"
      :description="`This will clear your current session (${store.bankroll.roundsPlayed} rounds, ${formatCents(store.profitLoss)} P&L) and return to the setup screen.`"
    >
      <template #body>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showNewGameConfirm = false"
          />
          <UButton
            color="error"
            label="New Game"
            icon="i-lucide-rotate-ccw"
            @click="confirmNewGame"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
