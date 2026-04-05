<script setup lang="ts">
import { formatCents, formatMultiplier } from '~/types/flameout'

const store = useFlameoutStore()

onMounted(() => {
  if (!store.isPlaying) {
    store.loadFromLocalStorage()
  }
})

const reversedHistory = computed(() => [...store.roundHistory].reverse())

function crashColor(point: number): string {
  if (point === 1.00) return 'text-red-500'
  if (point < 1.20) return 'text-red-400'
  if (point < 1.50) return 'text-orange-400'
  if (point < 2.00) return 'text-yellow-400'
  if (point < 5.00) return 'text-emerald-400'
  return 'text-emerald-300'
}
</script>

<template>
  <div class="flex-1 bg-neutral-950 overflow-y-auto">
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-200">
          Round History
        </h1>
        <p class="text-neutral-500 text-sm mt-1">
          {{ store.roundHistory.length }} rounds recorded
        </p>
      </div>

      <div v-if="reversedHistory.length === 0" class="text-center py-16">
        <p class="text-neutral-600">
          No rounds played yet. Start a game to see history.
        </p>
      </div>

      <div v-else class="rounded-xl border border-neutral-800 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-neutral-900/80">
            <tr class="text-neutral-500 text-xs uppercase tracking-wider">
              <th class="px-4 py-2.5 text-left">
                #
              </th>
              <th class="px-4 py-2.5 text-right">
                Crash
              </th>
              <th class="px-4 py-2.5 text-right">
                Bet
              </th>
              <th class="px-4 py-2.5 text-right">
                Cashout
              </th>
              <th class="px-4 py-2.5 text-right">
                Profit
              </th>
              <th class="px-4 py-2.5 text-right">
                Balance
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/50">
            <tr v-for="round in reversedHistory" :key="round.id" class="hover:bg-neutral-900/40">
              <td class="px-4 py-2 text-neutral-500 font-mono text-xs">
                {{ round.id }}
              </td>
              <td class="px-4 py-2 text-right font-mono font-bold" :class="crashColor(round.crashPoint)">
                {{ formatMultiplier(round.crashPoint) }}
              </td>
              <td class="px-4 py-2 text-right text-neutral-300 font-mono">
                {{ round.bet > 0 ? formatCents(round.bet) : '—' }}
              </td>
              <td class="px-4 py-2 text-right font-mono" :class="round.cashoutMultiplier ? 'text-emerald-400' : 'text-neutral-600'">
                {{ round.cashoutMultiplier ? formatMultiplier(round.cashoutMultiplier) : '—' }}
              </td>
              <td
                class="px-4 py-2 text-right font-mono"
                :class="round.profit > 0 ? 'text-emerald-400' : round.profit < 0 ? 'text-red-400' : 'text-neutral-600'"
              >
                {{ round.bet > 0 ? (round.profit >= 0 ? '+' : '') + formatCents(round.profit) : '—' }}
              </td>
              <td class="px-4 py-2 text-right text-neutral-400 font-mono">
                {{ formatCents(round.balanceAfter) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
