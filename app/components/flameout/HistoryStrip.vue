<script setup lang="ts">
import { formatMultiplier, formatCents } from '~/types/flameout'

const store = useFlameoutStore()

const recentCrashes = computed(() => {
  return store.roundHistory.slice(-30).reverse()
})

function badgeClass(point: number): string {
  if (point === 1.00) return 'bg-red-600/80 text-red-100 animate-pulse'
  if (point < 1.20) return 'bg-red-500/60 text-red-200'
  if (point < 1.50) return 'bg-orange-500/50 text-orange-200'
  if (point < 2.00) return 'bg-yellow-500/40 text-yellow-200'
  if (point < 5.00) return 'bg-emerald-500/40 text-emerald-200'
  if (point < 10.00) return 'bg-emerald-400/50 text-emerald-100'
  return 'bg-emerald-300/60 text-emerald-50'
}

const hoveredRound = ref<number | null>(null)
const tooltipStyle = ref({ left: '0px', bottom: '0px' })

function showTooltip(e: MouseEvent, roundId: number) {
  hoveredRound.value = roundId
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const parentRect = target.closest('.history-strip')?.getBoundingClientRect()
  if (parentRect) {
    tooltipStyle.value = {
      left: `${rect.left - parentRect.left + rect.width / 2}px`,
      bottom: `${parentRect.height + 4}px`
    }
  }
}

function hideTooltip() {
  hoveredRound.value = null
}

const tooltipRound = computed(() => {
  if (hoveredRound.value === null) return null
  return store.roundHistory.find(r => r.id === hoveredRound.value) || null
})
</script>

<template>
  <div class="history-strip border-t border-neutral-800 bg-neutral-900/80 shrink-0 overflow-hidden relative">
    <div class="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hide">
      <span class="text-[10px] text-neutral-600 uppercase tracking-wider shrink-0 mr-1">History</span>
      <span
        v-for="round in recentCrashes"
        :key="round.id"
        class="px-2 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 cursor-default transition-all hover:scale-110 hover:ring-1 hover:ring-white/20"
        :class="badgeClass(round.crashPoint)"
        @mouseenter="showTooltip($event, round.id)"
        @mouseleave="hideTooltip"
      >
        {{ formatMultiplier(round.crashPoint) }}
      </span>
      <span v-if="recentCrashes.length === 0" class="text-[10px] text-neutral-700 italic">
        No rounds yet — place a bet to start
      </span>
    </div>

    <!-- Tooltip popover -->
    <Transition
      enter-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-75"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="tooltipRound"
        class="absolute z-50 -translate-x-1/2 pointer-events-none"
        :style="tooltipStyle"
      >
        <div class="bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-2.5 min-w-[160px]">
          <div class="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">
            Round #{{ tooltipRound.id }}
          </div>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between gap-4">
              <span class="text-neutral-500">Crashed at</span>
              <span class="font-mono font-bold" :class="tooltipRound.crashPoint === 1.00 ? 'text-red-400' : 'text-amber-400'">
                {{ formatMultiplier(tooltipRound.crashPoint) }}
              </span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-neutral-500">Bet</span>
              <span class="font-mono text-neutral-300">
                {{ tooltipRound.bet > 0 ? formatCents(tooltipRound.bet) : '—' }}
              </span>
            </div>
            <div v-if="tooltipRound.bet > 0" class="flex justify-between gap-4">
              <span class="text-neutral-500">Cashout</span>
              <span class="font-mono" :class="tooltipRound.cashoutMultiplier ? 'text-emerald-400' : 'text-neutral-600'">
                {{ tooltipRound.cashoutMultiplier ? formatMultiplier(tooltipRound.cashoutMultiplier) : 'missed' }}
              </span>
            </div>
            <div v-if="tooltipRound.bet > 0" class="flex justify-between gap-4 border-t border-neutral-700 pt-1 mt-1">
              <span class="text-neutral-500">Result</span>
              <span
                class="font-mono font-bold"
                :class="tooltipRound.profit > 0 ? 'text-emerald-400' : tooltipRound.profit < 0 ? 'text-red-400' : 'text-neutral-500'"
              >
                {{ tooltipRound.profit >= 0 ? '+' : '' }}{{ formatCents(tooltipRound.profit) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
