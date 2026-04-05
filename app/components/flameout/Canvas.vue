<script setup lang="ts">
const store = useFlameoutStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const curvePoints = ref<{ x: number; y: number; m: number }[]>([])

const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

function getColor(multiplier: number): string {
  if (multiplier >= 10) return '#ef4444'
  if (multiplier >= 5) return '#f97316'
  if (multiplier >= 3) return '#f59e0b'
  if (multiplier >= 2) return '#eab308'
  return '#34d399'
}

function yForMultiplier(m: number, height: number, maxM: number): number {
  const margin = 20
  const usable = height - margin * 2
  const logMax = Math.log(Math.max(maxM, 1.5))
  const logM = Math.log(Math.max(m, 1))
  return height - margin - (logM / logMax) * usable
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * DPR
  canvas.height = rect.height * DPR
  ctx.scale(DPR, DPR)

  const w = rect.width
  const h = rect.height

  ctx.clearRect(0, 0, w, h)

  const round = store.currentRound
  if (!round) return

  const maxM = Math.max(
    round.currentMultiplier * 1.3,
    store.settings.autoCashoutTarget || 2,
    2
  )

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  const gridMultipliers = [1, 1.5, 2, 3, 5, 10, 20, 50, 100].filter(m => m <= maxM * 1.2)
  for (const gm of gridMultipliers) {
    const y = yForMultiplier(gm, h, maxM)
    if (y > 10 && y < h - 10) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()

      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`${gm}×`, 4, y - 3)
    }
  }

  // Auto-cashout line
  if (store.settings.autoCashoutTarget && store.settings.autoCashoutTarget <= maxM * 1.2) {
    const acY = yForMultiplier(store.settings.autoCashoutTarget, h, maxM)
    ctx.strokeStyle = 'rgba(251,191,36,0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, acY)
    ctx.lineTo(w, acY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Track points during running phase
  if (store.phase === 'RUNNING' && curvePoints.value.length > 0) {
    const points = curvePoints.value
    const maxTime = points[points.length - 1].x || 1
    const margin = 40

    // Draw curve
    ctx.beginPath()
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let i = 0; i < points.length; i++) {
      const px = margin + (points[i].x / maxTime) * (w - margin * 2)
      const py = yForMultiplier(points[i].m, h, maxM)

      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }

    ctx.strokeStyle = getColor(round.currentMultiplier)
    ctx.shadowColor = getColor(round.currentMultiplier)
    ctx.shadowBlur = 8
    ctx.stroke()
    ctx.shadowBlur = 0

    // Sprite (flame dot) at tip
    const last = points[points.length - 1]
    const tipX = margin + (last.x / maxTime) * (w - margin * 2)
    const tipY = yForMultiplier(last.m, h, maxM)

    const grad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 12)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.3, getColor(round.currentMultiplier))
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(tipX, tipY, 12, 0, Math.PI * 2)
    ctx.fill()
  }

  // Crash state — show final curve in red
  if (store.phase === 'CRASHED' && curvePoints.value.length > 0) {
    const points = curvePoints.value
    const maxTime = points[points.length - 1].x || 1
    const margin = 40

    ctx.beginPath()
    ctx.lineWidth = 2
    for (let i = 0; i < points.length; i++) {
      const px = margin + (points[i].x / maxTime) * (w - margin * 2)
      const py = yForMultiplier(points[i].m, h, maxM)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = 'rgba(239,68,68,0.5)'
    ctx.stroke()
  }
}

let rafId: number | null = null

function renderLoop() {
  if (store.phase === 'RUNNING' && store.currentRound) {
    curvePoints.value.push({
      x: store.currentRound.elapsedMs,
      y: 0,
      m: store.currentRound.currentMultiplier
    })
  }
  draw()

  if (store.phase === 'RUNNING' || store.phase === 'CRASHED') {
    rafId = requestAnimationFrame(renderLoop)
  }
}

watch(() => store.phase, (phase) => {
  if (phase === 'RUNNING') {
    curvePoints.value = []
    renderLoop()
  } else if (phase === 'WAITING') {
    curvePoints.value = []
    if (rafId) cancelAnimationFrame(rafId)
    draw()
  } else if (phase === 'CRASHED') {
    // Keep rendering for crash animation
    setTimeout(() => {
      if (rafId) cancelAnimationFrame(rafId)
    }, 1500)
  }
})

onMounted(() => {
  draw()
  window.addEventListener('resize', draw)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', draw)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="w-full h-full max-h-[400px]"
    style="aspect-ratio: 2/1;"
  />
</template>
