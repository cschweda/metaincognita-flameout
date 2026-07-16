<script setup lang="ts">
import { formatCents, dollarsToCents } from '~/types/flameout'
import type { BatchSimResult, StrategyType } from '~/types/flameout'
import { runBatchSimulation, STRATEGY_OPTIONS } from '~/composables/useFlameoutStrategy'
import { clampNumber } from '~/utils/flameout-math'

const STRATEGY_COLORS: Record<StrategyType, string> = {
  flat: '#34d399',
  martingale: '#ef4444',
  dalembert: '#60a5fa',
  fibonacci: '#f59e0b',
  paroli: '#c084fc'
}

const ROUND_PRESETS = [1_000, 10_000, 100_000]
const EDGE_PRESETS = [1, 3, 5]

// ── Config ──────────────────────────────────────────────────────────────────

const compareAll = ref(true)
const strategyType = ref<StrategyType>('martingale')
const baseBetDollars = ref(1)
const cashoutTarget = ref(2.0)
const rounds = ref(10_000)
const bankrollDollars = ref(1000)
const houseEdge = ref(3)
const seed = ref(1337)

function randomizeSeed() {
  seed.value = Math.floor(Math.random() * 1_000_000_000)
}

// ── Results ─────────────────────────────────────────────────────────────────

interface LabRun {
  type: StrategyType
  label: string
  color: string
  result: BatchSimResult
}

const runs = ref<LabRun[]>([])
const simDurationMs = ref<number | null>(null)

function runSimulation() {
  // Clamp free-typed inputs (a cashout target below 1.01× would "win" every
  // round at a nonsense RTP) and write back so the form shows the values
  // actually simulated.
  baseBetDollars.value = clampNumber(baseBetDollars.value, 0.1, 100, 1)
  cashoutTarget.value = clampNumber(cashoutTarget.value, 1.01, 1000, 2)
  bankrollDollars.value = clampNumber(bankrollDollars.value, 10, 1_000_000, 1000)
  if (!Number.isFinite(seed.value)) seed.value = 1337

  const types: StrategyType[] = compareAll.value
    ? STRATEGY_OPTIONS.map(o => o.value)
    : [strategyType.value]

  const started = performance.now()
  runs.value = types.map((type) => {
    const option = STRATEGY_OPTIONS.find(o => o.value === type)!
    return {
      type,
      label: option.label,
      color: STRATEGY_COLORS[type],
      result: runBatchSimulation({
        rounds: rounds.value,
        houseEdgePercent: houseEdge.value,
        startingBankroll: dollarsToCents(bankrollDollars.value),
        // Same seed for every strategy: identical crash sequence, so the
        // only difference between curves is the betting system itself.
        seed: seed.value,
        strategy: {
          type,
          baseBet: dollarsToCents(baseBetDollars.value),
          cashoutTarget: cashoutTarget.value
        }
      })
    }
  })
  simDurationMs.value = performance.now() - started
}

const totalRoundsSimulated = computed(() =>
  runs.value.reduce((a, r) => a + r.result.roundsPlayed, 0))

const expectedLossPerDollar = computed(() => houseEdge.value / 100)

// ── Chart ───────────────────────────────────────────────────────────────────

const CHART_W = 600
const CHART_H = 220
const CHART_PAD = 8

// Linear hides everything below a Martingale spike; log shows the grind.
const logScale = ref(false)

const chartMaxBalance = computed(() =>
  Math.max(1, ...runs.value.map(r => r.result.peakBalance)))

function curvePath(curve: number[]): string {
  if (curve.length < 2) return ''
  const maxLen = Math.max(2, ...runs.value.map(r => r.result.balanceCurve.length))
  const stride = Math.max(1, Math.ceil(curve.length / 300))
  const pts: string[] = []
  for (let i = 0; i < curve.length; i += stride) {
    pts.push(chartPoint(i, curve[i]!, maxLen))
  }
  // Always include the final point (bust endings matter)
  pts.push(chartPoint(curve.length - 1, curve[curve.length - 1]!, maxLen))
  return pts.join(' ')
}

function yForBalance(balance: number): number {
  const usable = CHART_H - CHART_PAD * 2
  // Log scale floors at 1¢ so busts still reach the bottom of the chart
  const frac = logScale.value
    ? Math.log10(Math.max(balance, 1)) / Math.log10(Math.max(chartMaxBalance.value, 10))
    : balance / chartMaxBalance.value
  return CHART_H - CHART_PAD - frac * usable
}

function chartPoint(index: number, balance: number, maxLen: number): string {
  const x = CHART_PAD + (index / (maxLen - 1)) * (CHART_W - CHART_PAD * 2)
  return `${x.toFixed(1)},${yForBalance(balance).toFixed(1)}`
}

const startBalanceY = computed(() => yForBalance(dollarsToCents(bankrollDollars.value)))

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

function formatRound(n: number | null): string {
  return n === null ? '—' : `@ ${n.toLocaleString()}`
}
</script>

<template>
  <section
    id="strategy-lab"
    class="rounded-xl bg-neutral-900/60 border border-neutral-800 p-5 space-y-5 scroll-mt-16"
  >
    <div>
      <h3 class="text-sm font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
        <UIcon
          name="i-lucide-flask-conical"
          class="w-4 h-4 text-amber-400"
        />
        Strategy Lab
      </h3>
      <p class="text-neutral-500 text-xs mt-1">
        Batch-simulate betting systems over thousands of rounds. Every system faces the
        identical crash sequence (same seed) — the only variable is how it sizes bets.
      </p>
    </div>

    <!-- Config -->
    <div class="space-y-4">
      <!-- Mode + strategy -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="px-3 py-1.5 rounded-lg text-xs border transition-all"
          :class="compareAll
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
            : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300'"
          @click="compareAll = !compareAll"
        >
          Compare all five systems
        </button>

        <template v-if="!compareAll">
          <span class="text-neutral-700">|</span>
          <button
            v-for="option in STRATEGY_OPTIONS"
            :key="option.value"
            class="px-2.5 py-1.5 rounded-lg text-xs border transition-all"
            :class="strategyType === option.value
              ? 'border-amber-500 bg-amber-500/10 text-amber-400'
              : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600'"
            :title="option.description"
            @click="strategyType = option.value"
          >
            {{ option.label }}
          </button>
        </template>
      </div>

      <!-- Numeric params -->
      <div class="flex flex-wrap items-end gap-x-5 gap-y-3">
        <label class="flex flex-col gap-1 text-xs text-neutral-500">
          Base bet
          <span class="flex items-center gap-1">
            $<input
              v-model.number="baseBetDollars"
              type="number"
              :min="0.1"
              :max="100"
              step="any"
              class="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono text-right focus:border-amber-500 focus:outline-none"
            >
          </span>
        </label>

        <label class="flex flex-col gap-1 text-xs text-neutral-500">
          Cashout target
          <span class="flex items-center gap-1">
            <input
              v-model.number="cashoutTarget"
              type="number"
              :min="1.01"
              :max="1000"
              step="any"
              class="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono text-right focus:border-amber-500 focus:outline-none"
            >×
          </span>
        </label>

        <label class="flex flex-col gap-1 text-xs text-neutral-500">
          Bankroll
          <span class="flex items-center gap-1">
            $<input
              v-model.number="bankrollDollars"
              type="number"
              :min="10"
              :max="1000000"
              step="any"
              class="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono text-right focus:border-amber-500 focus:outline-none"
            >
          </span>
        </label>

        <div class="flex flex-col gap-1 text-xs text-neutral-500">
          Rounds
          <div class="flex gap-1">
            <button
              v-for="preset in ROUND_PRESETS"
              :key="preset"
              class="px-2 py-1 rounded text-xs border transition-all font-mono"
              :class="rounds === preset
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600'"
              @click="rounds = preset"
            >
              {{ preset >= 1000 ? `${preset / 1000}K` : preset }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1 text-xs text-neutral-500">
          House edge
          <div class="flex gap-1">
            <button
              v-for="preset in EDGE_PRESETS"
              :key="preset"
              class="px-2 py-1 rounded text-xs border transition-all font-mono"
              :class="houseEdge === preset
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600'"
              @click="houseEdge = preset"
            >
              {{ preset }}%
            </button>
          </div>
        </div>

        <label class="flex flex-col gap-1 text-xs text-neutral-500">
          Seed
          <span class="flex items-center gap-1">
            <input
              v-model.number="seed"
              type="number"
              :min="0"
              class="w-28 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 font-mono text-right focus:border-amber-500 focus:outline-none"
            >
            <button
              class="p-1 rounded border border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-amber-400 hover:border-neutral-600 transition-colors"
              title="Randomize seed"
              aria-label="Randomize seed"
              @click="randomizeSeed"
            >
              <UIcon
                name="i-lucide-dices"
                class="w-4 h-4 block"
              />
            </button>
          </span>
        </label>

        <button
          class="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm transition-all active:scale-[0.98] flex items-center gap-2"
          @click="runSimulation"
        >
          <UIcon
            name="i-lucide-play"
            class="w-4 h-4"
          />
          Run Simulation
        </button>
      </div>
    </div>

    <!-- Results -->
    <template v-if="runs.length > 0">
      <!-- Balance curves -->
      <div class="space-y-2">
        <svg
          :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
          class="w-full rounded-lg bg-neutral-950/80 border border-neutral-800"
          role="img"
          aria-label="Bankroll balance over simulated rounds, one line per betting system"
        >
          <!-- Starting balance reference line -->
          <line
            :x1="CHART_PAD"
            :x2="CHART_W - CHART_PAD"
            :y1="startBalanceY"
            :y2="startBalanceY"
            stroke="rgba(255,255,255,0.12)"
            stroke-dasharray="4 4"
            stroke-width="1"
          />
          <!-- y-axis anchors: chart top value, and the starting bankroll -->
          <text
            :x="CHART_PAD + 2"
            y="12"
            fill="rgba(255,255,255,0.35)"
            font-size="9"
            font-family="monospace"
          >{{ formatCents(chartMaxBalance) }}</text>
          <text
            :x="CHART_W - CHART_PAD - 2"
            :y="Math.max(12, startBalanceY - 4)"
            text-anchor="end"
            fill="rgba(255,255,255,0.3)"
            font-size="9"
            font-family="monospace"
          >start {{ formatCents(dollarsToCents(bankrollDollars)) }}</text>
          <polyline
            v-for="run in runs"
            :key="run.type"
            :points="curvePath(run.result.balanceCurve)"
            :stroke="run.color"
            stroke-width="1.5"
            fill="none"
            stroke-linejoin="round"
          />
        </svg>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span
            v-for="run in runs"
            :key="run.type"
            class="flex items-center gap-1.5"
          >
            <span
              class="w-2.5 h-2.5 rounded-full inline-block"
              :style="{ backgroundColor: run.color }"
            />
            <span class="text-neutral-400">{{ run.label }}</span>
            <span
              v-if="run.result.busted"
              class="text-red-400 font-mono"
            >busted {{ formatRound(run.result.bustedAtRound) }}</span>
          </span>
          <button
            class="ml-auto px-2 py-0.5 rounded text-[10px] border transition-all font-mono"
            :class="logScale
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300'"
            :aria-pressed="logScale"
            title="Log y-axis — see the grind under the Martingale spikes"
            @click="logScale = !logScale"
          >
            log y
          </button>
          <span class="text-neutral-600 font-mono">
            dashed line = starting bankroll
          </span>
        </div>
      </div>

      <!-- Results table -->
      <div class="rounded-lg border border-neutral-800 overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-neutral-900/80">
            <tr class="text-neutral-500 uppercase tracking-wider">
              <th class="px-3 py-2 text-left">
                System
              </th>
              <th class="px-3 py-2 text-right">
                Final Balance
              </th>
              <th class="px-3 py-2 text-right">
                P/L
              </th>
              <th class="px-3 py-2 text-right">
                Wagered
              </th>
              <th class="px-3 py-2 text-right">
                Empirical RTP
              </th>
              <th class="px-3 py-2 text-right">
                Win Rate
              </th>
              <th class="px-3 py-2 text-right">
                Busted
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/50">
            <tr
              v-for="run in runs"
              :key="run.type"
              class="hover:bg-neutral-900/40"
            >
              <td class="px-3 py-2">
                <span class="flex items-center gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full inline-block"
                    :style="{ backgroundColor: run.color }"
                  />
                  <span class="text-neutral-300">{{ run.label }}</span>
                </span>
              </td>
              <td class="px-3 py-2 text-right font-mono text-neutral-300">
                {{ formatCents(run.result.finalBalance) }}
              </td>
              <td
                class="px-3 py-2 text-right font-mono"
                :class="run.result.finalBalance >= dollarsToCents(bankrollDollars) ? 'text-emerald-400' : 'text-red-400'"
              >
                {{ run.result.finalBalance >= dollarsToCents(bankrollDollars) ? '+' : '' }}{{ formatCents(run.result.finalBalance - dollarsToCents(bankrollDollars)) }}
              </td>
              <td class="px-3 py-2 text-right font-mono text-neutral-400">
                {{ formatCents(run.result.totalWagered) }}
              </td>
              <td class="px-3 py-2 text-right font-mono text-amber-400">
                {{ formatPercent(run.result.empiricalRTP) }}
              </td>
              <td class="px-3 py-2 text-right font-mono text-neutral-400">
                {{ formatPercent(run.result.roundsPlayed > 0 ? run.result.roundsWon / run.result.roundsPlayed : 0) }}
              </td>
              <td
                class="px-3 py-2 text-right font-mono"
                :class="run.result.busted ? 'text-red-400' : 'text-neutral-600'"
              >
                {{ run.result.busted ? formatRound(run.result.bustedAtRound) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- The lesson -->
      <div class="rounded-lg bg-neutral-950/60 border border-neutral-800 p-3 space-y-1.5">
        <p class="text-xs text-neutral-400">
          <strong class="text-amber-400">The takeaway:</strong> every system's loss converges to
          <span class="font-mono">total wagered × {{ houseEdge }}%</span> house edge
          (expected loss {{ formatCents(Math.round(runs[0]!.result.totalWagered * expectedLossPerDollar)) }}
          for {{ runs[0]!.label }}'s wagering, for example). Betting systems change the
          <em>shape</em> of the ride — Martingale grinds upward then collapses, Paroli swings —
          but never the destination. Re-roll the seed and watch the same story repeat.
        </p>
        <p
          v-if="simDurationMs !== null"
          class="text-[10px] text-neutral-600 font-mono"
        >
          Simulated {{ totalRoundsSimulated.toLocaleString() }} rounds in {{ simDurationMs.toFixed(0) }}ms
          · seed {{ seed }} · identical crash sequence across systems
        </p>
      </div>
    </template>
  </section>
</template>
