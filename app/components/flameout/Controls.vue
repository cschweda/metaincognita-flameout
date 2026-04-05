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
    <div class="flex flex-col items-center gap-2 py-3 px-4">
      <!-- Main action button — BIG and impossible to miss -->

      <!-- WAITING: Place Bet -->
      <button
        v-if="store.phase === 'WAITING'"
        :disabled="!store.canPlaceBet"
        class="w-full max-w-md py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-lg tracking-wide transition-all duration-150 shadow-lg shadow-emerald-900/30 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        @click="handleAction"
      >
        <UIcon name="i-lucide-rocket" class="w-5 h-5" />
        Place Bet ({{ formatCents(store.pendingBet) }})
      </button>

      <!-- RUNNING: Cash Out — pulsing, urgent, unmissable -->
      <button
        v-else-if="store.phase === 'RUNNING' && store.canCashOut"
        class="w-full max-w-md py-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-2xl tracking-wide transition-all duration-100 shadow-xl shadow-amber-900/40 active:scale-[0.97] animate-pulse flex items-center justify-center gap-3 ring-2 ring-amber-400/50 ring-offset-2 ring-offset-neutral-950"
        @click="handleAction"
      >
        <UIcon name="i-lucide-hand" class="w-7 h-7" />
        CASH OUT {{ formatMultiplier(store.currentRound?.currentMultiplier || 1) }}
      </button>

      <!-- RUNNING but already cashed out: show winnings -->
      <div
        v-else-if="store.phase === 'RUNNING' && store.currentRound?.cashedOut"
        class="w-full max-w-md py-4 rounded-xl bg-emerald-600/20 border-2 border-emerald-500/40 text-emerald-400 font-bold text-lg text-center"
      >
        Cashed out at {{ formatMultiplier(store.currentRound?.cashoutMultiplier || 0) }}
      </div>

      <!-- CRASHED -->
      <div
        v-else-if="store.phase === 'CRASHED'"
        class="w-full max-w-md py-4 rounded-xl bg-red-600/20 border-2 border-red-500/40 text-red-400 font-bold text-lg text-center"
      >
        {{ store.currentRound?.cashedOut
          ? `Won! Cashed out at ${formatMultiplier(store.currentRound?.cashoutMultiplier || 0)}`
          : `Crashed at ${formatMultiplier(store.currentRound?.crashPoint || 0)}`
        }}
      </div>

      <!-- SETTLING -->
      <div
        v-else
        class="w-full max-w-md py-3 rounded-xl bg-neutral-800/50 border border-neutral-700 text-neutral-500 font-medium text-center"
      >
        Next round...
      </div>

      <!-- Controls row -->
      <div class="flex flex-wrap items-center justify-center gap-2">
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

        <span class="text-neutral-700">|</span>

        <!-- Auto-cashout -->
        <div class="flex items-center gap-1">
          <span class="text-xs text-neutral-500">Auto-cashout:</span>
          <input
            v-model.number="autoCashoutInput"
            type="number"
            :min="1.01"
            :max="10000"
            step="0.1"
            placeholder="off"
            class="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono text-right focus:border-amber-500 focus:outline-none"
          >
          <span class="text-xs text-neutral-500">×</span>
        </div>

        <span class="text-neutral-700">|</span>

        <!-- Auto-bet toggle -->
        <button
          class="flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all"
          :class="store.settings.autoBet
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
            : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300'"
          @click="toggleAutoBet"
        >
          <UIcon name="i-lucide-repeat" class="w-3 h-3" />
          Auto-bet
        </button>

        <!-- Spacebar hint -->
        <span class="text-[10px] text-neutral-600 ml-1">
          [Space]
        </span>
      </div>
    </div>
  </div>
</template>
