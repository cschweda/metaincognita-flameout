<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const store = useFlameoutStore()
const engine = useFlameoutEngine()

const isSetup = computed(() => route.path === '/')
const isGame = computed(() => route.path === '/game')
const isSubPage = computed(() => ['/history', '/analysis', '/learn'].includes(route.path))

const showLeaveConfirm = ref(false)

function handleBack() {
  if (isGame.value) {
    showLeaveConfirm.value = true
  } else if (isSubPage.value) {
    router.back()
  }
}

function confirmLeave() {
  showLeaveConfirm.value = false
  // Cancel any in-flight round timers before parking the session
  engine.cleanup()
  store.saveToLocalStorage()
  store.setPhase('SETUP')
  router.push('/')
}

// Runs on nav-link click before NuxtLink routes — parks the live session
function saveSession() {
  if (store.isPlaying) {
    store.saveToLocalStorage()
  }
}
</script>

<template>
  <div class="h-screen bg-neutral-950 flex flex-col overflow-hidden">
    <!-- Top status bar -->
    <nav class="h-9 flex items-center justify-between px-3 bg-neutral-900 border-b border-neutral-800 shrink-0 z-50">
      <div class="flex items-center gap-2">
        <button
          v-if="!isSetup"
          class="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          @click="handleBack"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="w-3.5 h-3.5"
          />
          <span>Back</span>
        </button>
        <span
          v-else
          class="text-xs text-neutral-600"
        >
          <span class="text-amber-500/60">Flameout</span> Simulator
        </span>
      </div>
      <div
        v-if="store.isPlaying && !isSetup"
        class="flex items-center gap-1"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
        <span class="text-[10px] text-neutral-500">Session active</span>
      </div>
    </nav>

    <!-- Page content -->
    <div class="flex-1 flex flex-col min-h-0">
      <slot />
    </div>

    <!-- Bottom status bar -->
    <nav class="h-9 flex items-center justify-between px-3 bg-neutral-900 border-t border-neutral-800 shrink-0 z-50">
      <div class="flex items-center gap-4">
        <NuxtLink
          to="/history"
          class="flex items-center gap-1.5 text-xs transition-colors"
          :class="route.path === '/history' ? 'text-amber-400' : 'text-neutral-500 hover:text-neutral-300'"
          @click="saveSession"
        >
          <UIcon
            name="i-lucide-scroll-text"
            class="w-3.5 h-3.5"
          />
          <span>History</span>
        </NuxtLink>
        <NuxtLink
          to="/analysis"
          class="flex items-center gap-1.5 text-xs transition-colors"
          :class="route.path === '/analysis' ? 'text-amber-400' : 'text-neutral-500 hover:text-neutral-300'"
          @click="saveSession"
        >
          <UIcon
            name="i-lucide-chart-no-axes-combined"
            class="w-3.5 h-3.5"
          />
          <span>Analysis</span>
        </NuxtLink>
        <NuxtLink
          to="/learn"
          class="flex items-center gap-1.5 text-xs transition-colors"
          :class="route.path === '/learn' ? 'text-amber-400' : 'text-neutral-500 hover:text-neutral-300'"
          @click="saveSession"
        >
          <UIcon
            name="i-lucide-book-open"
            class="w-3.5 h-3.5"
          />
          <span>Learn</span>
        </NuxtLink>
      </div>
      <a
        href="https://github.com/cschweda/metaincognita-flameout"
        target="_blank"
        class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <UIcon
          name="i-simple-icons-github"
          class="w-3.5 h-3.5"
        />
        <span>GitHub</span>
      </a>
    </nav>

    <!-- Leave confirmation modal -->
    <UModal
      v-model:open="showLeaveConfirm"
      title="Leave Game?"
      description="Your session will be saved. You can resume later from the setup screen."
    >
      <template #body>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showLeaveConfirm = false"
          />
          <UButton
            color="primary"
            label="Leave & Save"
            @click="confirmLeave"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
