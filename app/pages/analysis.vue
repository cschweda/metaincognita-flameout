<script setup lang="ts">
import { formatCents } from '~/types/flameout'

const store = useFlameoutStore()
const analytics = useFlameoutAnalytics()

onMounted(() => {
  if (!store.isPlaying) {
    store.loadFromLocalStorage()
  }
})

const stats = computed(() => analytics.sessionStats.value)

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}
</script>

<template>
  <div class="flex-1 bg-neutral-950 overflow-y-auto">
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 class="text-2xl font-bold text-neutral-200">
          Session Analysis
        </h1>
        <p class="text-neutral-500 text-sm mt-1">
          Mathematical breakdown of your session
        </p>
      </div>

      <div v-if="store.bankroll.roundsPlayed === 0" class="text-center py-16">
        <p class="text-neutral-600">
          No rounds played yet. Start a game to see analysis.
        </p>
      </div>

      <template v-else>
        <!-- Summary cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-lg bg-neutral-900/80 border border-neutral-800 p-4">
            <div class="text-xs text-neutral-500 uppercase tracking-wider">
              Rounds
            </div>
            <div class="text-xl font-bold text-neutral-200 mt-1 font-mono">
              {{ stats.roundsPlayed }}
            </div>
          </div>
          <div class="rounded-lg bg-neutral-900/80 border border-neutral-800 p-4">
            <div class="text-xs text-neutral-500 uppercase tracking-wider">
              Win Rate
            </div>
            <div class="text-xl font-bold text-neutral-200 mt-1 font-mono">
              {{ formatPercent(stats.winRate) }}
            </div>
          </div>
          <div class="rounded-lg bg-neutral-900/80 border border-neutral-800 p-4">
            <div class="text-xs text-neutral-500 uppercase tracking-wider">
              Empirical RTP
            </div>
            <div class="text-xl font-bold mt-1 font-mono" :class="stats.empiricalRTP >= 1 ? 'text-emerald-400' : 'text-red-400'">
              {{ formatPercent(stats.empiricalRTP) }}
            </div>
          </div>
          <div class="rounded-lg bg-neutral-900/80 border border-neutral-800 p-4">
            <div class="text-xs text-neutral-500 uppercase tracking-wider">
              Net P&L
            </div>
            <div
              class="text-xl font-bold mt-1 font-mono"
              :class="stats.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'"
            >
              {{ stats.profitLoss >= 0 ? '+' : '' }}{{ formatCents(stats.profitLoss) }}
            </div>
          </div>
        </div>

        <!-- Detailed stats -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Financial -->
          <div class="rounded-xl bg-neutral-900/60 border border-neutral-800 p-5 space-y-3">
            <h3 class="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Financial
            </h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-neutral-500">Total Wagered</span>
                <span class="text-neutral-300 font-mono">{{ formatCents(stats.totalWagered) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-500">Total Returned</span>
                <span class="text-neutral-300 font-mono">{{ formatCents(stats.totalReturned) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-500">Peak Balance</span>
                <span class="text-neutral-300 font-mono">{{ formatCents(stats.peakBalance) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-500">Max Drawdown</span>
                <span class="text-red-400 font-mono">{{ formatCents(stats.maxDrawdown) }}</span>
              </div>
              <div class="flex justify-between border-t border-neutral-800 pt-2">
                <span class="text-neutral-500">Theoretical RTP</span>
                <span class="text-neutral-400 font-mono">{{ formatPercent(1 - store.settings.houseEdgePercent / 100) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-500">Actual RTP</span>
                <span class="font-mono" :class="stats.empiricalRTP >= 1 ? 'text-emerald-400' : 'text-amber-400'">
                  {{ formatPercent(stats.empiricalRTP) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Streaks -->
          <div class="rounded-xl bg-neutral-900/60 border border-neutral-800 p-5 space-y-3">
            <h3 class="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Streaks
            </h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-neutral-500">Current Streak</span>
                <span
                  class="font-mono font-bold"
                  :class="stats.currentStreak > 0 ? 'text-emerald-400' : stats.currentStreak < 0 ? 'text-red-400' : 'text-neutral-500'"
                >
                  {{ stats.currentStreak > 0 ? `W${stats.currentStreak}` : stats.currentStreak < 0 ? `L${Math.abs(stats.currentStreak)}` : '—' }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-500">Longest Win Streak</span>
                <span class="text-emerald-400 font-mono">{{ stats.longestWinStreak }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-500">Longest Loss Streak</span>
                <span class="text-red-400 font-mono">{{ stats.longestLossStreak }}</span>
              </div>
              <div class="flex justify-between border-t border-neutral-800 pt-2">
                <span class="text-neutral-500">Rounds Won</span>
                <span class="text-emerald-400 font-mono">{{ stats.roundsWon }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-500">Rounds Lost</span>
                <span class="text-red-400 font-mono">{{ stats.roundsLost }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Distribution -->
        <div class="rounded-xl bg-neutral-900/60 border border-neutral-800 p-5 space-y-3">
          <h3 class="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
            Crash Point Distribution
          </h3>
          <div class="space-y-1.5">
            <div
              v-for="bin in analytics.distributionData.value"
              :key="bin.label"
              class="flex items-center gap-3 text-xs"
            >
              <span class="text-neutral-500 w-24 text-right font-mono shrink-0">{{ bin.label }}</span>
              <div class="flex-1 bg-neutral-800 rounded-full h-4 overflow-hidden relative">
                <div
                  class="h-full bg-amber-500/60 rounded-full transition-all duration-300"
                  :style="{ width: `${store.roundHistory.length > 0 ? (bin.count / store.roundHistory.length) * 100 : 0}%` }"
                />
                <div
                  class="absolute top-0 left-0 h-full border-r-2 border-amber-300/40"
                  :style="{ width: `${store.roundHistory.length > 0 ? (bin.expected / store.roundHistory.length) * 100 : 0}%` }"
                />
              </div>
              <span class="text-neutral-500 w-10 text-right font-mono shrink-0">{{ bin.count }}</span>
            </div>
          </div>
          <p class="text-[10px] text-neutral-600 mt-2">
            Bars = observed. Markers = theoretical. Converges over many rounds.
          </p>
        </div>

        <!-- Crash stats -->
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4 text-center">
            <div class="text-xs text-neutral-500 uppercase tracking-wider">
              Avg Crash
            </div>
            <div class="text-lg font-bold text-amber-400 mt-1 font-mono">
              {{ analytics.averageCrashPoint.value.toFixed(2) }}×
            </div>
          </div>
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4 text-center">
            <div class="text-xs text-neutral-500 uppercase tracking-wider">
              Median Crash
            </div>
            <div class="text-lg font-bold text-amber-400 mt-1 font-mono">
              {{ analytics.medianCrashPoint.value.toFixed(2) }}×
            </div>
          </div>
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4 text-center">
            <div class="text-xs text-neutral-500 uppercase tracking-wider">
              Instant Crashes
            </div>
            <div class="text-lg font-bold text-red-400 mt-1 font-mono">
              {{ formatPercent(analytics.instantCrashRate.value) }}
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
