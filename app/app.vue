<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'Flameout — Crash Game Simulator',
  description: 'A free crash game simulator for learning casino mathematics. Explore probability, expected value, and house edge with interactive tools. No real money.',
  ogTitle: 'Flameout — Crash Game Simulator | Metaincognita',
  ogDescription: 'Watch the multiplier climb. Cash out before the crash. Then see why the house always wins.'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
