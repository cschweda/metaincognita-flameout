<script setup lang="ts">
import { formatCents, formatMultiplier } from '~/types/flameout'

const router = useRouter()
const store = useFlameoutStore()
const engine = useFlameoutEngine()

// Redirect to setup if no active game
onMounted(() => {
  if (!store.isPlaying) {
    const loaded = store.loadFromLocalStorage()
    if (!loaded || !store.isPlaying) {
      router.replace('/')
      return
    }
  }

  // Start the first round if we're in WAITING
  if (store.phase === 'WAITING') {
    engine.startBettingPhase()
  }
})

onUnmounted(() => {
  engine.cleanup()
})

// Keyboard: space to bet/cashout
function handleKeydown(e: KeyboardEvent) {
  if (e.code === 'Space') {
    e.preventDefault()
    if (store.phase === 'WAITING') {
      engine.placeBetAndStart(store.pendingBet)
    } else if (store.canCashOut) {
      engine.cashOut()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const showSidebar = ref(true)

const phaseLabel = computed(() => {
  switch (store.phase) {
    case 'WAITING': return 'Place Your Bet'
    case 'RUNNING': return 'LIVE'
    case 'CRASHED': return `Crashed at ${formatMultiplier(store.currentRound?.crashPoint || 0)}`
    case 'SETTLING': return 'Settling...'
    case 'BUSTED': return 'Busted!'
    default: return ''
  }
})

const phaseBadgeClass = computed(() => {
  switch (store.phase) {
    case 'WAITING': return 'bg-blue-600/80 text-blue-100'
    case 'RUNNING': return 'bg-emerald-600/80 text-emerald-100 animate-pulse'
    case 'CRASHED': return 'bg-red-600/80 text-red-100'
    case 'BUSTED': return 'bg-red-700/80 text-red-100'
    default: return 'bg-neutral-700 text-neutral-300'
  }
})

const multiplierColor = computed(() => {
  const m = store.currentRound?.currentMultiplier || 1
  if (store.phase === 'CRASHED') return 'text-red-500'
  if (m >= 10) return 'text-red-400'
  if (m >= 5) return 'text-orange-400'
  if (m >= 3) return 'text-amber-400'
  if (m >= 2) return 'text-yellow-400'
  return 'text-emerald-400'
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
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
          @click="showSidebar = !showSidebar"
        >
          <UIcon :name="showSidebar ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'" class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 flex overflow-hidden min-h-0">
      <!-- Left: game area -->
      <div class="flex-1 flex flex-col min-w-0 min-h-0">
        <!-- Phase badge -->
        <div class="flex items-center justify-center py-2 shrink-0">
          <span class="px-3 py-1 rounded-full text-xs font-bold" :class="phaseBadgeClass">
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
            v-if="store.phase === 'RUNNING' || store.phase === 'CRASHED'"
            class="text-5xl font-bold font-mono tabular-nums transition-colors"
            :class="multiplierColor"
          >
            {{ formatMultiplier(store.currentRound?.currentMultiplier || 1) }}
          </div>
          <div
            v-else-if="store.phase === 'BUSTED'"
            class="text-center"
          >
            <p class="text-2xl font-bold text-red-500">
              Bankroll Exhausted
            </p>
            <UButton color="amber" label="Re-buy" class="mt-3" @click="engine.rebuy()" />
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
  </div>
</template>
