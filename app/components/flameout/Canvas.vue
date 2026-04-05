<script setup lang="ts">
const store = useFlameoutStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const curvePoints = ref<{ x: number; y: number; m: number }[]>([])

const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

// ── Trail particles ─────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

const particles = ref<Particle[]>([])
let frameCount = 0

function spawnTrailParticle(x: number, y: number, color: string) {
  if (particles.value.length >= 30) return
  particles.value.push({
    x,
    y,
    vx: (Math.random() - 0.7) * 1.5,
    vy: (Math.random() - 0.3) * 1.2,
    life: 0,
    maxLife: 300 + Math.random() * 300,
    size: 2 + Math.random() * 3,
    color
  })
}

function spawnCrashBurst(x: number, y: number) {
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.3
    const speed = 1.5 + Math.random() * 3
    particles.value.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 500 + Math.random() * 500,
      size: 3 + Math.random() * 4,
      color: ['#ef4444', '#f97316', '#fbbf24', '#ffffff'][Math.floor(Math.random() * 4)]
    })
  }
}

function updateParticles(dt: number) {
  particles.value = particles.value.filter((p) => {
    p.life += dt
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.02 // gravity
    return p.life < p.maxLife
  })
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of particles.value) {
    const alpha = 1 - p.life / p.maxLife
    const size = p.size * (1 - p.life / p.maxLife * 0.5)
    ctx.globalAlpha = alpha * 0.8
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ── Colors ──────────────────────────────────────────────────────────────────

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

// ── Jet sprite drawing ──────────────────────────────────────────────────────

function drawJet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, scale: number = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(scale, scale)

  // Afterburner flame (behind the jet)
  const flicker = 0.8 + Math.random() * 0.4
  const flameLen = 18 * flicker

  // Outer flame glow
  const flameGrad = ctx.createLinearGradient(-flameLen - 10, 0, -4, 0)
  flameGrad.addColorStop(0, 'rgba(0,0,0,0)')
  flameGrad.addColorStop(0.3, 'rgba(255,100,0,0.3)')
  flameGrad.addColorStop(0.7, 'rgba(255,200,50,0.6)')
  flameGrad.addColorStop(1, 'rgba(255,255,200,0.8)')
  ctx.fillStyle = flameGrad
  ctx.beginPath()
  ctx.moveTo(-4, 0)
  ctx.lineTo(-flameLen - 6, -5 * flicker)
  ctx.lineTo(-flameLen - 10, 0)
  ctx.lineTo(-flameLen - 6, 5 * flicker)
  ctx.closePath()
  ctx.fill()

  // Inner flame (brighter core)
  const innerGrad = ctx.createLinearGradient(-flameLen, 0, -2, 0)
  innerGrad.addColorStop(0, 'rgba(0,0,0,0)')
  innerGrad.addColorStop(0.5, 'rgba(255,220,100,0.5)')
  innerGrad.addColorStop(1, 'rgba(255,255,255,0.9)')
  ctx.fillStyle = innerGrad
  ctx.beginPath()
  ctx.moveTo(-2, 0)
  ctx.lineTo(-flameLen + 2, -2.5 * flicker)
  ctx.lineTo(-flameLen, 0)
  ctx.lineTo(-flameLen + 2, 2.5 * flicker)
  ctx.closePath()
  ctx.fill()

  // Jet body
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.moveTo(14, 0)       // nose
  ctx.lineTo(4, -4)       // top front
  ctx.lineTo(-6, -5)      // top rear
  ctx.lineTo(-8, -3)      // tail top
  ctx.lineTo(-8, 3)       // tail bottom
  ctx.lineTo(-6, 5)       // bottom rear
  ctx.lineTo(4, 4)        // bottom front
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  // Wings
  ctx.fillStyle = color
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.moveTo(2, -4)
  ctx.lineTo(-4, -12)
  ctx.lineTo(-6, -11)
  ctx.lineTo(-4, -5)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(2, 4)
  ctx.lineTo(-4, 12)
  ctx.lineTo(-6, 11)
  ctx.lineTo(-4, 5)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1

  // Tail fin
  ctx.fillStyle = color
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(-6, -5)
  ctx.lineTo(-10, -9)
  ctx.lineTo(-10, -7)
  ctx.lineTo(-8, -3)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1

  // Cockpit (white highlight)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.ellipse(8, -1, 3, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ── Main draw function ──────────────────────────────────────────────────────

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

  const margin = 40

  // Draw curve + jet during RUNNING
  if (store.phase === 'RUNNING' && curvePoints.value.length > 1) {
    const points = curvePoints.value
    const maxTime = points[points.length - 1].x || 1

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

    const color = getColor(round.currentMultiplier)
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.stroke()
    ctx.shadowBlur = 0

    // Compute tip position and angle
    const last = points[points.length - 1]
    const prev = points[Math.max(0, points.length - 5)]
    const tipX = margin + (last.x / maxTime) * (w - margin * 2)
    const tipY = yForMultiplier(last.m, h, maxM)
    const prevX = margin + (prev.x / maxTime) * (w - margin * 2)
    const prevY = yForMultiplier(prev.m, h, maxM)
    const angle = Math.atan2(tipY - prevY, tipX - prevX)

    // Spawn trail particles every few frames
    frameCount++
    if (frameCount % 2 === 0) {
      spawnTrailParticle(tipX - Math.cos(angle) * 10, tipY - Math.sin(angle) * 10, color)
    }

    // Draw particles behind the jet
    drawParticles(ctx)

    // Draw jet sprite
    drawJet(ctx, tipX, tipY, angle, color, 1.4)
  }

  // Crashed state — static curve + burst
  if (store.phase === 'CRASHED' && curvePoints.value.length > 1) {
    const points = curvePoints.value
    const maxTime = points[points.length - 1].x || 1
    const cashedOut = round.cashedOut

    ctx.beginPath()
    ctx.lineWidth = 2
    for (let i = 0; i < points.length; i++) {
      const px = margin + (points[i].x / maxTime) * (w - margin * 2)
      const py = yForMultiplier(points[i].m, h, maxM)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = cashedOut ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'
    ctx.stroke()

    // Draw remaining particles (from crash burst)
    drawParticles(ctx)

    // If cashed out, draw a static jet at the cashout point
    if (cashedOut) {
      const last = points[points.length - 1]
      const prev = points[Math.max(0, points.length - 5)]
      const tipX = margin + (last.x / maxTime) * (w - margin * 2)
      const tipY = yForMultiplier(last.m, h, maxM)
      const prevX = margin + (prev.x / maxTime) * (w - margin * 2)
      const prevY = yForMultiplier(prev.m, h, maxM)
      const angle = Math.atan2(tipY - prevY, tipX - prevX)
      ctx.globalAlpha = 0.6
      drawJet(ctx, tipX, tipY, angle, '#34d399', 1.4)
      ctx.globalAlpha = 1
    }
  }
}

// ── Animation loop ──────────────────────────────────────────────────────────

let rafId: number | null = null
let lastTime = 0

function renderLoop(time: number = 0) {
  const dt = lastTime ? time - lastTime : 16
  lastTime = time

  if (store.phase === 'RUNNING' && store.currentRound) {
    curvePoints.value.push({
      x: store.currentRound.elapsedMs,
      y: 0,
      m: store.currentRound.currentMultiplier
    })
  }

  updateParticles(dt)
  draw()

  if (store.phase === 'RUNNING' || store.phase === 'CRASHED') {
    rafId = requestAnimationFrame(renderLoop)
  }
}

watch(() => store.phase, (phase) => {
  if (phase === 'RUNNING') {
    curvePoints.value = []
    particles.value = []
    frameCount = 0
    lastTime = 0
    renderLoop()
  } else if (phase === 'WAITING') {
    curvePoints.value = []
    particles.value = []
    if (rafId) cancelAnimationFrame(rafId)
    draw()
  } else if (phase === 'CRASHED') {
    // Spawn crash burst at the tip
    if (curvePoints.value.length > 1 && !store.currentRound?.cashedOut) {
      const points = curvePoints.value
      const last = points[points.length - 1]
      const maxTime = last.x || 1
      const canvas = canvasRef.value
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const margin = 40
        const w = rect.width
        const h = rect.height
        const maxM = Math.max((store.currentRound?.currentMultiplier || 2) * 1.3, 2)
        const tipX = margin + (last.x / maxTime) * (w - margin * 2)
        const tipY = yForMultiplier(last.m, h, maxM)
        spawnCrashBurst(tipX, tipY)
      }
    }
    // Keep rendering for particle animation
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
