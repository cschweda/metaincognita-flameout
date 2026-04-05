<script setup lang="ts">
import { formatCents, formatMultiplier } from '~/types/flameout'

const store = useFlameoutStore()
const analytics = useFlameoutAnalytics()

const stats = computed(() => analytics.sessionStats.value)

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

const activeTab = ref<'session' | 'probability'>('session')
const probInput = ref(2)
const probResult = computed(() => {
  const p = analytics.getProbability(probInput.value)
  const ev = analytics.getExpectedValue()
  const breakEven = analytics.getBreakEvenRate(probInput.value)
  return { probability: p, ev, breakEven }
})
</script>

<template>
  <div class="h-full flex flex-col bg-neutral-950 overflow-hidden">
    <!-- Tab bar -->
    <div class="flex border-b border-neutral-800 shrink-0">
      <button
        class="flex-1 py-2 text-xs font-medium text-center transition-colors"
        :class="activeTab === 'session' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-neutral-500 hover:text-neutral-300'"
        @click="activeTab = 'session'"
      >
        Session
      </button>
      <button
        class="flex-1 py-2 text-xs font-medium text-center transition-colors"
        :class="activeTab === 'probability' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-neutral-500 hover:text-neutral-300'"
        @click="activeTab = 'probability'"
      >
        Probability
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-3 space-y-4">
      <!-- Session tab -->
      <template v-if="activeTab === 'session'">
        <!-- Balance -->
        <div class="text-center pb-3 border-b border-neutral-800">
          <div class="text-xs text-neutral-500 uppercase tracking-wider">
            Balance
          </div>
          <div class="text-2xl font-bold text-neutral-100 font-mono mt-1">
            {{ formatCents(store.bankroll.balance) }}
          </div>
          <div
            class="text-xs font-mono mt-0.5"
            :class="store.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'"
          >
            {{ store.profitLoss >= 0 ? '+' : '' }}{{ formatCents(store.profitLoss) }}
          </div>
        </div>

        <!-- Quick stats grid -->
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-neutral-900/60 rounded-lg p-2.5">
            <div class="text-[10px] text-neutral-600 uppercase">
              Rounds
            </div>
            <div class="text-sm font-bold text-neutral-200 font-mono">
              {{ stats.roundsPlayed }}
            </div>
          </div>
          <div class="bg-neutral-900/60 rounded-lg p-2.5">
            <div class="text-[10px] text-neutral-600 uppercase">
              Win Rate
            </div>
            <div class="text-sm font-bold text-neutral-200 font-mono">
              {{ formatPercent(stats.winRate) }}
            </div>
          </div>
          <div class="bg-neutral-900/60 rounded-lg p-2.5">
            <div class="text-[10px] text-neutral-600 uppercase">
              Wagered
            </div>
            <div class="text-sm font-bold text-neutral-200 font-mono">
              {{ formatCents(stats.totalWagered) }}
            </div>
          </div>
          <div class="bg-neutral-900/60 rounded-lg p-2.5">
            <div class="text-[10px] text-neutral-600 uppercase">
              RTP
            </div>
            <div
              class="text-sm font-bold font-mono"
              :class="stats.empiricalRTP >= 1 ? 'text-emerald-400' : 'text-amber-400'"
            >
              {{ stats.roundsPlayed > 0 ? formatPercent(stats.empiricalRTP) : '—' }}
            </div>
          </div>
        </div>

        <!-- Streaks -->
        <div class="space-y-1.5 text-xs">
          <div class="text-neutral-600 uppercase tracking-wider text-[10px] font-medium">
            Streaks
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Current</span>
            <span
              class="font-mono font-bold"
              :class="stats.currentStreak > 0 ? 'text-emerald-400' : stats.currentStreak < 0 ? 'text-red-400' : 'text-neutral-600'"
            >
              {{ stats.currentStreak > 0 ? `W${stats.currentStreak}` : stats.currentStreak < 0 ? `L${Math.abs(stats.currentStreak)}` : '—' }}
            </span>
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Best Win</span>
            <span class="font-mono text-emerald-400">{{ stats.longestWinStreak }}</span>
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Worst Loss</span>
            <span class="font-mono text-red-400">{{ stats.longestLossStreak }}</span>
          </div>
        </div>

        <!-- Financial details -->
        <div class="space-y-1.5 text-xs">
          <div class="text-neutral-600 uppercase tracking-wider text-[10px] font-medium">
            Financial
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Peak Balance</span>
            <span class="font-mono text-neutral-300">{{ formatCents(stats.peakBalance) }}</span>
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Max Drawdown</span>
            <span class="font-mono text-red-400">{{ formatCents(stats.maxDrawdown) }}</span>
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Returned</span>
            <span class="font-mono text-neutral-300">{{ formatCents(stats.totalReturned) }}</span>
          </div>
        </div>

        <!-- Crash stats -->
        <div class="space-y-1.5 text-xs">
          <div class="text-neutral-600 uppercase tracking-wider text-[10px] font-medium">
            Crash Points
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Average</span>
            <span class="font-mono text-amber-400">{{ analytics.averageCrashPoint.value.toFixed(2) }}×</span>
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Median</span>
            <span class="font-mono text-amber-400">{{ analytics.medianCrashPoint.value.toFixed(2) }}×</span>
          </div>
          <div class="flex justify-between text-neutral-400">
            <span>Instant (1.00×)</span>
            <span class="font-mono text-red-400">{{ formatPercent(analytics.instantCrashRate.value) }}</span>
          </div>
        </div>

        <!-- Config reminder -->
        <div class="pt-2 border-t border-neutral-800 space-y-1 text-[10px] text-neutral-600">
          <div class="flex justify-between">
            <span>House Edge</span>
            <span>{{ store.settings.houseEdgePercent }}%</span>
          </div>
          <div class="flex justify-between">
            <span>Theoretical RTP</span>
            <span>{{ ((1 - store.settings.houseEdgePercent / 100) * 100).toFixed(1) }}%</span>
          </div>
          <div class="flex justify-between">
            <span>Speed</span>
            <span>{{ store.settings.speedFactor }}×</span>
          </div>
        </div>
      </template>

      <!-- Probability tab -->
      <template v-if="activeTab === 'probability'">
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs text-neutral-400">Target Multiplier</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="probInput"
                type="number"
                :min="1.01"
                :max="1000"
                step="0.1"
                class="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 font-mono focus:border-amber-500 focus:outline-none"
              >
              <span class="text-neutral-500 text-sm">×</span>
            </div>
            <input
              v-model.number="probInput"
              type="range"
              :min="1.01"
              :max="100"
              step="0.01"
              class="w-full accent-amber-500"
            >
          </div>

          <div class="space-y-2 text-sm">
            <div class="bg-neutral-900/60 rounded-lg p-3 space-y-2">
              <div class="flex justify-between text-neutral-400">
                <span>P(reaching {{ probInput.toFixed(2) }}×)</span>
                <span class="font-mono text-amber-400 font-bold">
                  {{ (probResult.probability * 100).toFixed(2) }}%
                </span>
              </div>
              <div class="flex justify-between text-neutral-400">
                <span>Implied odds</span>
                <span class="font-mono text-neutral-300">
                  ~1 in {{ (1 / probResult.probability).toFixed(1) }}
                </span>
              </div>
              <div class="flex justify-between text-neutral-400">
                <span>Break-even rate</span>
                <span class="font-mono text-neutral-300">
                  {{ (probResult.breakEven * 100).toFixed(2) }}%
                </span>
              </div>
              <div class="flex justify-between text-neutral-400">
                <span>EV per $1</span>
                <span class="font-mono text-red-400">
                  {{ probResult.ev >= 0 ? '+' : '' }}${{ probResult.ev.toFixed(4) }}
                </span>
              </div>
            </div>

            <p class="text-[10px] text-neutral-600 leading-relaxed">
              The EV is {{ probResult.ev.toFixed(4) }} per dollar regardless of cashout target.
              This is the house edge: {{ store.settings.houseEdgePercent }}%. No strategy changes this.
            </p>
          </div>

          <!-- Common targets reference -->
          <div class="space-y-1.5">
            <div class="text-[10px] text-neutral-600 uppercase tracking-wider font-medium">
              Common Targets
            </div>
            <div
              v-for="m in [1.5, 2, 3, 5, 10, 20, 50, 100]"
              :key="m"
              class="flex justify-between text-xs text-neutral-500"
            >
              <span>{{ formatMultiplier(m) }}</span>
              <span class="font-mono">{{ (analytics.getProbability(m) * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
