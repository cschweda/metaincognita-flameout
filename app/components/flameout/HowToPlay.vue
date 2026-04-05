<script setup lang="ts">
const show = ref(false)

onMounted(() => {
  const seen = localStorage.getItem('flameout-how-to-play-seen')
  if (!seen) {
    show.value = true
  }
})

function dismiss() {
  show.value = false
  localStorage.setItem('flameout-how-to-play-seen', '1')
}
</script>

<template>
  <UModal
    v-model:open="show"
    title="How to Play"
    description="It's the simplest casino game there is."
  >
    <template #body>
      <div class="space-y-4">
        <!-- Step 1 -->
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-sm">
            1
          </div>
          <div>
            <p class="text-neutral-200 font-medium text-sm">
              Place your bet
            </p>
            <p class="text-neutral-500 text-xs mt-0.5">
              Set your bet amount, then click the green <strong class="text-emerald-400">Place Bet</strong> button (or press <kbd class="px-1 rounded bg-neutral-800 text-neutral-300">Space</kbd>).
            </p>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-amber-600/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-sm">
            2
          </div>
          <div>
            <p class="text-neutral-200 font-medium text-sm">
              Watch the multiplier rise
            </p>
            <p class="text-neutral-500 text-xs mt-0.5">
              The multiplier starts at 1.00× and climbs. Your potential payout = bet × current multiplier. But it could crash at <em>any</em> moment.
            </p>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-orange-600/20 text-orange-400 flex items-center justify-center shrink-0 font-bold text-sm">
            3
          </div>
          <div>
            <p class="text-neutral-200 font-medium text-sm">
              Cash out before the crash!
            </p>
            <p class="text-neutral-500 text-xs mt-0.5">
              Hit the big pulsing <strong class="text-amber-400">CASH OUT</strong> button (or <kbd class="px-1 rounded bg-neutral-800 text-neutral-300">Space</kbd>) to lock in your winnings. If the game crashes first, you lose your bet.
            </p>
          </div>
        </div>

        <!-- Step 4 -->
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center shrink-0 font-bold text-sm">
            !
          </div>
          <div>
            <p class="text-neutral-200 font-medium text-sm">
              The catch
            </p>
            <p class="text-neutral-500 text-xs mt-0.5">
              ~3% of rounds crash instantly at 1.00× — everyone loses no matter what. That's the house edge. Over time, no strategy beats it. The analytics panel will prove this to you.
            </p>
          </div>
        </div>
      </div>

      <!-- Tips -->
      <div class="rounded-lg bg-neutral-900/80 border border-neutral-800 p-3 space-y-1.5 mt-4">
        <p class="text-[10px] text-neutral-600 uppercase tracking-wider font-medium">
          Tips
        </p>
        <p class="text-xs text-neutral-500">
          <strong class="text-neutral-400">Auto-cashout:</strong> Set a target multiplier and it cashes out automatically when reached.
        </p>
        <p class="text-xs text-neutral-500">
          <strong class="text-neutral-400">Auto-bet:</strong> Automatically places the same bet each round — combine with auto-cashout to observe the math hands-free.
        </p>
        <p class="text-xs text-neutral-500">
          <strong class="text-neutral-400">Stats sidebar:</strong> Shows your session stats, and a probability calculator for any multiplier target.
        </p>
      </div>

      <button
        class="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-base transition-all active:scale-[0.98]"
        @click="dismiss"
      >
        Got it — let's play
      </button>
    </template>
  </UModal>
</template>
