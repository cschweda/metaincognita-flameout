<script setup lang="ts">
import { formatCents, formatMultiplier } from '~/types/flameout'

const store = useFlameoutStore()
const engine = useFlameoutEngine()

const betInput = ref(store.pendingBet / 100)

watch(betInput, (val) => {
  store.pendingBet = Math.round(val * 100)
})

function halveBet() {
  betInput.value = Math.max(store.settings.minBet / 100, Math.floor(betInput.value / 2 * 100) / 100)
}

function doubleBet() {
  const max = Math.min(store.settings.maxBet, store.bankroll.balance) / 100
  betInput.value = Math.min(max, betInput.value * 2)
}

function maxBet() {
  betInput.value = Math.min(store.settings.maxBet, store.bankroll.balance) / 100
}

function handleAction() {
  if (store.phase === 'WAITING') {
    engine.placeBetAndStart(store.pendingBet)
  } else if (store.canCashOut) {
    engine.cashOut()
  }
}

const actionLabel = computed(() => {
  if (store.phase === 'WAITING') return `Place Bet (${formatCents(store.pendingBet)})`
  if (store.phase === 'RUNNING' && store.canCashOut) {
    return `Cash Out (${formatMultiplier(store.currentRound?.currentMultiplier || 1)})`
  }
  if (store.phase === 'CRASHED') return `Crashed at ${formatMultiplier(store.currentRound?.crashPoint || 0)}`
  if (store.phase === 'SETTLING') return 'Next Round...'
  return '...'
})

const actionColor = computed(() => {
  if (store.phase === 'WAITING') return 'emerald' as const
  if (store.phase === 'RUNNING') return 'amber' as const
  return 'neutral' as const
})

const actionDisabled = computed(() => {
  if (store.phase === 'WAITING') return !store.canPlaceBet
  if (store.phase === 'RUNNING') return !store.canCashOut
  return true
})

const autoCashoutInput = ref<number | null>(store.settings.autoCashoutTarget)

watch(autoCashoutInput, (val) => {
  store.updateSettings({
    autoCashoutTarget: val && val >= 1.01 ? val : null
  })
})

function toggleAutoBet() {
  store.updateSettings({ autoBet: !store.settings.autoBet })
}
</script>

<template>
  <div class="border-t border-neutral-800 bg-neutral-900/60 shrink-0">
    <div class="flex flex-wrap items-center justify-center gap-2 py-2.5 px-4">
      <!-- Bet input -->
      <div class="flex items-center gap-1">
        <span class="text-xs text-neutral-500">$</span>
        <input
          v-model.number="betInput"
          type="number"
          :min="store.settings.minBet / 100"
          :max="Math.min(store.settings.maxBet, store.bankroll.balance) / 100"
          step="1"
          :disabled="store.phase !== 'WAITING'"
          class="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono text-right focus:border-amber-500 focus:outline-none disabled:opacity-50"
        >
      </div>

      <!-- Quick bet buttons -->
      <button
        class="px-2 py-1 rounded text-xs bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 disabled:opacity-50"
        :disabled="store.phase !== 'WAITING'"
        @click="halveBet"
      >
        ½
      </button>
      <button
        class="px-2 py-1 rounded text-xs bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 disabled:opacity-50"
        :disabled="store.phase !== 'WAITING'"
        @click="doubleBet"
      >
        2×
      </button>
      <button
        class="px-2 py-1 rounded text-xs bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 disabled:opacity-50"
        :disabled="store.phase !== 'WAITING'"
        @click="maxBet"
      >
        Max
      </button>

      <!-- Main action button -->
      <UButton
        size="lg"
        :color="actionColor"
        :label="actionLabel"
        :disabled="actionDisabled"
        class="min-w-[200px]"
        @click="handleAction"
      />

      <!-- Auto-cashout -->
      <div class="flex items-center gap-1">
        <span class="text-xs text-neutral-500">Auto:</span>
        <input
          v-model.number="autoCashoutInput"
          type="number"
          :min="1.01"
          :max="10000"
          step="0.1"
          placeholder="—"
          class="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono text-right focus:border-amber-500 focus:outline-none"
        >
        <span class="text-xs text-neutral-500">×</span>
      </div>

      <!-- Auto-bet toggle -->
      <button
        class="flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all"
        :class="store.settings.autoBet
          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
          : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300'"
        @click="toggleAutoBet"
      >
        <UIcon name="i-lucide-repeat" class="w-3 h-3" />
        Auto
      </button>
    </div>
  </div>
</template>
