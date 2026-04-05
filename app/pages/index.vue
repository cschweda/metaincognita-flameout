<script setup lang="ts">
const router = useRouter()
const store = useFlameoutStore()

const houseEdge = ref(3)
const startingBankroll = ref(1000)
const speedFactor = ref(1)

const houseEdgePresets = [
  { value: 1, label: '1%', description: '99% RTP — Low edge (Stake-style)' },
  { value: 3, label: '3%', description: '97% RTP — Standard (Aviator-style)' },
  { value: 5, label: '5%', description: '95% RTP — High edge' }
]

const speedPresets = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 5, label: '5×' }
]

const bankrollPresets = [100, 500, 1000, 5000, 10000]

const hasResumableSession = ref(false)

onMounted(() => {
  hasResumableSession.value = store.loadFromLocalStorage() && store.phase !== 'SETUP'
  if (!hasResumableSession.value) {
    store.clearSession()
  }
})

function startGame() {
  store.initializeGame({
    houseEdgePercent: houseEdge.value,
    startingBankroll: startingBankroll.value,
    speedFactor: speedFactor.value
  })
  router.push('/game')
}

function resumeGame() {
  router.push('/game')
}
</script>

<template>
  <div class="flex-1 bg-neutral-950 flex items-start justify-center px-4 py-10 overflow-y-auto">
    <div class="w-full max-w-[800px] space-y-8">
      <!-- Header -->
      <div class="text-center space-y-2">
        <h1 class="text-4xl font-bold tracking-tight">
          <span class="text-amber-400">Flameout</span>
          <span class="text-neutral-300"> Simulator</span>
        </h1>
        <p class="text-neutral-500 text-sm">
          A crash game simulator. No real money. Just math.
        </p>
      </div>

      <!-- Resume banner -->
      <div
        v-if="hasResumableSession"
        class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-center justify-between"
      >
        <div>
          <p class="text-amber-400 text-sm font-medium">
            Session in progress
          </p>
          <p class="text-neutral-500 text-xs mt-0.5">
            {{ store.bankroll.roundsPlayed }} rounds played
          </p>
        </div>
        <UButton color="amber" label="Resume" @click="resumeGame" />
      </div>

      <!-- Setup card -->
      <div class="rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-2xl shadow-black/20 p-6 sm:p-8 space-y-8">
        <!-- House Edge -->
        <div class="space-y-3">
          <label class="text-sm font-medium text-neutral-300">House Edge / RTP</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="preset in houseEdgePresets"
              :key="preset.value"
              class="rounded-lg border p-3 text-center transition-all"
              :class="houseEdge === preset.value
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600'"
              @click="houseEdge = preset.value"
            >
              <div class="text-lg font-bold">
                {{ preset.label }}
              </div>
              <div class="text-[10px] mt-1 opacity-70">
                {{ preset.description }}
              </div>
            </button>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-neutral-500">Custom:</span>
            <UInput
              v-model.number="houseEdge"
              type="number"
              :min="0.5"
              :max="10"
              step="0.5"
              size="xs"
              class="w-20"
            />
            <span class="text-xs text-neutral-500">%</span>
          </div>
        </div>

        <div class="border-t border-neutral-800" />

        <!-- Starting Bankroll -->
        <div class="space-y-3">
          <label class="text-sm font-medium text-neutral-300">Starting Bankroll</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="amount in bankrollPresets"
              :key="amount"
              class="rounded-lg border px-4 py-2 text-sm font-mono transition-all"
              :class="startingBankroll === amount
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600'"
              @click="startingBankroll = amount"
            >
              ${{ amount.toLocaleString() }}
            </button>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-neutral-500">Custom: $</span>
            <UInput
              v-model.number="startingBankroll"
              type="number"
              :min="100"
              :max="1000000"
              step="100"
              size="xs"
              class="w-28"
            />
          </div>
        </div>

        <div class="border-t border-neutral-800" />

        <!-- Speed -->
        <div class="space-y-3">
          <label class="text-sm font-medium text-neutral-300">Game Speed</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in speedPresets"
              :key="preset.value"
              class="rounded-lg border px-4 py-2 text-sm transition-all"
              :class="speedFactor === preset.value
                ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600'"
              @click="speedFactor = preset.value"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div class="border-t border-neutral-800" />

        <!-- Start button -->
        <button
          class="w-full py-5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xl tracking-wide transition-all duration-200 shadow-lg shadow-amber-900/30 hover:shadow-amber-800/40 active:scale-[0.98] flex items-center justify-center gap-3"
          @click="startGame"
        >
          <UIcon name="i-lucide-flame" class="w-6 h-6" />
          Start Game
        </button>
      </div>

      <!-- Footer -->
      <p class="text-center text-neutral-600 text-xs">
        All amounts are for simulation purposes only. No real money is wagered.
      </p>
    </div>
  </div>
</template>
