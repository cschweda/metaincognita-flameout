<script setup lang="ts">
import { formatMultiplier, formatCents } from '~/types/flameout'
import type { RoundRecord } from '~/types/flameout'

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

function outcomeIcon(round: RoundRecord): string {
  if (!round.cashoutMultiplier) return '✗'
  return '✓'
}

function tooltipText(round: RoundRecord): string {
  const lines = [`Round #${round.id} — Crashed at ${formatMultiplier(round.crashPoint)}`]

  if (round.crashPoint === 1.00) {
    lines.push('Instant crash (house edge)')
  } else {
    lines.push(`A $10 bet here → $${(10 * round.crashPoint).toFixed(2)} max return`)
  }

  if (round.bet > 0) {
    lines.push('')
    lines.push(`Your bet: ${formatCents(round.bet)}`)
    if (round.cashoutMultiplier) {
      lines.push(`Cashed out at ${formatMultiplier(round.cashoutMultiplier)}`)
      lines.push(`Payout: ${formatCents(round.bet)} × ${formatMultiplier(round.cashoutMultiplier)} = ${formatCents(round.payout)}`)
      lines.push(`Result: ${round.profit >= 0 ? '+' : ''}${formatCents(round.profit)}`)
    } else {
      lines.push(`Didn't cash out — lost ${formatCents(round.bet)}`)
    }
  }

  return lines.join('\n')
}
</script>

<template>
  <div class="border-t border-neutral-800 bg-neutral-900/80 shrink-0">
    <div class="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hide">
      <span class="text-[10px] text-neutral-600 uppercase tracking-wider shrink-0 mr-1">Crash points</span>
      <UTooltip
        v-for="round in recentCrashes"
        :key="round.id"
        :text="tooltipText(round)"
      >
        <span
          class="px-2 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 cursor-default transition-all hover:scale-110 hover:ring-1 hover:ring-white/20 inline-flex items-center gap-0.5"
          :class="badgeClass(round.crashPoint)"
        >
          <span
            class="text-[9px]"
            :class="round.cashoutMultiplier ? 'opacity-80' : 'opacity-40'"
          >{{ outcomeIcon(round) }}</span>
          {{ formatMultiplier(round.crashPoint) }}
        </span>
      </UTooltip>
      <span v-if="recentCrashes.length === 0" class="text-[10px] text-neutral-700 italic">
        No rounds yet — place a bet to start
      </span>
    </div>
  </div>
</template>
