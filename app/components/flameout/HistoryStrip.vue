<script setup lang="ts">
import { formatMultiplier } from '~/types/flameout'

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
</script>

<template>
  <div class="border-t border-neutral-800 bg-neutral-900/80 shrink-0 overflow-hidden">
    <div class="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hide">
      <span class="text-[10px] text-neutral-600 uppercase tracking-wider shrink-0 mr-1">History</span>
      <span
        v-for="round in recentCrashes"
        :key="round.id"
        class="px-2 py-0.5 rounded text-[11px] font-mono font-bold shrink-0"
        :class="badgeClass(round.crashPoint)"
        :title="`Round ${round.id}: ${formatMultiplier(round.crashPoint)}`"
      >
        {{ formatMultiplier(round.crashPoint) }}
      </span>
      <span v-if="recentCrashes.length === 0" class="text-[10px] text-neutral-700 italic">
        No rounds yet
      </span>
    </div>
  </div>
</template>
