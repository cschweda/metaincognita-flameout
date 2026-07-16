<script setup lang="ts">
import { formatCents } from '~/types/flameout'
import type { GauntletItem, JackpotTrigger, FloatingText, SlotSpinState, CurrentRound } from '~/types/flameout'
import { currentMultiplier as calcMultiplier } from '~/utils/flameout-math'
import {
  makeStars,
  makeWisps,
  drawBackground,
  getColor,
  yForMultiplier,
  drawJet,
  drawGauntletItem,
  drawSlotTrigger,
  drawSlotOverlay,
  drawFloatingTexts,
  drawParticles
} from '~/utils/canvas-draw'
import type { Star, Wisp, Particle } from '~/utils/canvas-draw'
import {
  makeGauntletItem,
  gauntletSpawnInterval,
  makeJackpotTrigger,
  jackpotSpawnInterval,
  rollReels,
  calcSlotPayout
} from '~/utils/flameout-variants'
import { isEditableTarget } from '~/utils/keyboard'

const store = useFlameoutStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

const isGauntlet = computed(() => store.settings.gameMode === 'gauntlet')
const isJackpot = computed(() => store.settings.gameMode === 'jackpot')
const isVariantMode = computed(() => isGauntlet.value || isJackpot.value)

// ── Render-loop state ───────────────────────────────────────────────────────
// Plain (non-reactive) on purpose: only the draw loop reads this, and paying
// Vue proxy overhead on every per-frame mutation buys nothing.

let cssW = 0
let cssH = 0
// Read fresh on every resize — dragging the window to a monitor with a
// different pixel density must re-rasterize, not keep the old ratio.
let dpr = 1
let stars: Star[] = []
let wisps: Wisp[] = []
let particles: Particle[] = []
let curvePoints: { x: number, m: number }[] = []
let frameCount = 0
let globalTime = 0
let reducedMotion = false

let shakeIntensity = 0
let shakeDecay = 0

// Variant state
let gauntletItems: GauntletItem[] = []
let jackpotTriggers: JackpotTrigger[] = []
let floatingTexts: FloatingText[] = []
let playerYOffset = 0
let sideNetThisRound = 0
let nextItemId = 0
let lastSpawnMs = 0
let activeSpin: SlotSpinState | null = null
const keysDown = { up: false, down: false }

const SCROLL_PX_PER_MS = 0.12
const JET_X_FRAC = 0.28

// ── Particles & shake ───────────────────────────────────────────────────────

function spawnTrailParticle(x: number, y: number, color: string) {
  if (reducedMotion || particles.length >= 30) return
  particles.push({
    x, y,
    vx: (Math.random() - 0.7) * 1.5,
    vy: (Math.random() - 0.3) * 1.2,
    life: 0,
    maxLife: 300 + Math.random() * 300,
    size: 2 + Math.random() * 3,
    color
  })
}

function spawnCrashBurst(x: number, y: number) {
  if (reducedMotion) return
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.3
    const speed = 1.5 + Math.random() * 3
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 500 + Math.random() * 500,
      size: 3 + Math.random() * 4,
      color: (['#ef4444', '#f97316', '#fbbf24', '#ffffff'] as const)[Math.floor(Math.random() * 4)] as string
    })
  }
}

function updateParticles(dt: number) {
  particles = particles.filter((p) => {
    p.life += dt
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.02
    return p.life < p.maxLife
  })
}

function triggerShake(intensity: number, decay: number) {
  if (reducedMotion) return
  shakeIntensity = intensity
  shakeDecay = decay
}

// ── Shared geometry ─────────────────────────────────────────────────────────

// One source of truth for the vertical scale, so the crash burst lands
// exactly where the curve was drawn.
function computeMaxM(round: CurrentRound): number {
  return Math.max(round.currentMultiplier * 1.3, store.settings.autoCashoutTarget || 2, 2)
}

function maxPlayerOffset(): number {
  return cssH * 0.35
}

// ── Variant updates ─────────────────────────────────────────────────────────

function resetVariantState() {
  gauntletItems = []
  jackpotTriggers = []
  floatingTexts = []
  playerYOffset = 0
  sideNetThisRound = 0
  nextItemId = 0
  lastSpawnMs = 0
  activeSpin = null
}

function updatePlayerPosition(dt: number) {
  // Steering is per-millisecond, not per-frame — a 120Hz display must not
  // steer twice as fast as a 60Hz one. dt is clamped so the first frame
  // after a background tab can't teleport the jet.
  const frames = Math.min(dt, 50) / 16.67
  const moveSpeed = Math.max(3, cssH * 0.011) * frames
  if (keysDown.up) playerYOffset -= moveSpeed
  if (keysDown.down) playerYOffset += moveSpeed
  const limit = maxPlayerOffset()
  playerYOffset = Math.max(-limit, Math.min(limit, playerYOffset))
}

function updateFloatingTexts(dt: number, rise: number) {
  floatingTexts = floatingTexts.filter((ft) => {
    ft.life += dt
    ft.y -= rise
    return ft.life < ft.maxLife
  })
}

function updateGauntlet(currentMs: number, dt: number) {
  updatePlayerPosition(dt)

  if (currentMs - lastSpawnMs > gauntletSpawnInterval(currentMs)) {
    gauntletItems.push(makeGauntletItem(nextItemId++, currentMs))
    lastSpawnMs = currentMs
  }

  gauntletItems = gauntletItems.filter((item) => {
    if (item.collected || item.missed) return item.timeMs > currentMs - 1000
    if (item.timeMs < currentMs - 500) item.missed = true
    return true
  })

  updateFloatingTexts(dt, 0.8)
}

function updateJackpot(currentMs: number, dt: number) {
  updatePlayerPosition(dt)

  if (currentMs - lastSpawnMs > jackpotSpawnInterval(currentMs)) {
    jackpotTriggers.push(makeJackpotTrigger(nextItemId++, currentMs))
    lastSpawnMs = currentMs
  }

  jackpotTriggers = jackpotTriggers.filter((t) => {
    if (t.collected || t.missed) return t.timeMs > currentMs - 1500
    if (t.timeMs < currentMs - 500) t.missed = true
    return true
  })

  // Advance the spin phase machine
  if (activeSpin) {
    const elapsed = globalTime - activeSpin.startTime
    if (activeSpin.phase === 'spinning' && elapsed > 400) {
      activeSpin.phase = 'stop1'
    } else if (activeSpin.phase === 'stop1' && elapsed > 800) {
      activeSpin.phase = 'stop2'
    } else if (activeSpin.phase === 'stop2' && elapsed > 1200) {
      activeSpin.phase = 'stop3'
    } else if (activeSpin.phase === 'stop3' && elapsed > 1600) {
      activeSpin.phase = 'result'
      // Balance was already settled at collection — this is just the reveal
      if (activeSpin.payout > 0) {
        sideNetThisRound += activeSpin.payout
        const isTriple = activeSpin.reels[0] === activeSpin.reels[1] && activeSpin.reels[1] === activeSpin.reels[2]
        floatingTexts.push({
          x: activeSpin.triggerX,
          y: activeSpin.triggerY - 60,
          text: `+${formatCents(activeSpin.payout)}`,
          color: isTriple ? '#facc15' : '#34d399',
          life: 0,
          maxLife: 2000
        })
      }
    } else if (activeSpin.phase === 'result' && elapsed > 2500) {
      activeSpin = null
      // Unfreezes round time AND persists the shifted clock, so a reload
      // from here on resolves the round on the frozen timeline.
      store.endJackpotSpin()
    }
  }

  updateFloatingTexts(dt, 0.6)
}

// ── Drawing ─────────────────────────────────────────────────────────────────

function drawVariantTrail(
  ctx: CanvasRenderingContext2D,
  points: { x: number, m: number }[],
  currentMs: number,
  jetX: number,
  jetY: number,
  color: string,
  maxM: number
) {
  for (const pass of [{ width: 8, alpha: 0.12, blur: 20 }, { width: 3, alpha: 1, blur: 10 }]) {
    ctx.beginPath()
    ctx.lineWidth = pass.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    let started = false
    for (const pt of points) {
      const screenX = jetX - (currentMs - pt.x) * SCROLL_PX_PER_MS
      if (screenX < -10) continue
      const screenY = yForMultiplier(pt.m, cssH, maxM)
      if (!started) {
        ctx.moveTo(screenX, screenY)
        started = true
      } else {
        ctx.lineTo(screenX, screenY)
      }
    }
    ctx.lineTo(jetX, jetY)
    ctx.strokeStyle = color
    ctx.globalAlpha = pass.alpha
    ctx.shadowColor = color
    ctx.shadowBlur = pass.blur
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
}

function drawSideNetHud(ctx: CanvasRenderingContext2D, w: number, label: string) {
  if (sideNetThisRound === 0) return
  ctx.fillStyle = sideNetThisRound > 0 ? (isJackpot.value ? '#facc15' : '#34d399') : '#ef4444'
  ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.globalAlpha = 0.8
  const sign = sideNetThisRound > 0 ? '+' : ''
  ctx.fillText(`${label}: ${sign}${formatCents(sideNetThisRound)}`, w - 12, 12)
  ctx.globalAlpha = 1
}

function drawKeyHint(ctx: CanvasRenderingContext2D, currentMs: number, x: number, text: string) {
  if (currentMs >= 3000) return
  ctx.globalAlpha = Math.max(0, 1 - currentMs / 3000)
  ctx.fillStyle = '#737373'
  ctx.font = '11px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText(text, x, cssH - 15)
  ctx.globalAlpha = 1
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || cssW === 0 || cssH === 0) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = cssW
  const h = cssH

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  if (shakeIntensity > 0.5) {
    const sx = (Math.random() - 0.5) * shakeIntensity
    const sy = (Math.random() - 0.5) * shakeIntensity
    ctx.translate(sx, sy)
    shakeIntensity *= shakeDecay
  } else {
    shakeIntensity = 0
  }

  const round = store.currentRound
  const multiplier = round?.currentMultiplier || 1

  drawBackground(ctx, w, h, {
    multiplier,
    phase: store.phase,
    cashedOut: round?.cashedOut ?? false,
    globalTime,
    drift: store.phase === 'RUNNING',
    reducedMotion
  }, stars, wisps)

  if (!round) return

  const maxM = computeMaxM(round)
  const intensity = Math.min((multiplier - 1) / 8, 1)
  const margin = 40

  // ── Grid lines ─────────────────────────────────────────────────────────
  const gridAlpha = 0.04 + intensity * 0.04
  ctx.lineWidth = 1
  const gridMultipliers = [1, 1.5, 2, 3, 5, 10, 20, 50, 100].filter(m => m <= maxM * 1.2)
  for (const gm of gridMultipliers) {
    const y = yForMultiplier(gm, h, maxM)
    if (y > 10 && y < h - 10) {
      ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
      ctx.fillStyle = `rgba(255,255,255,${0.15 + intensity * 0.1})`
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`${gm}×`, 4, y - 3)
    }
  }

  // ── Auto-cashout line ──────────────────────────────────────────────────
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

  // ── RUNNING phase ──────────────────────────────────────────────────────
  if (store.phase === 'RUNNING' && curvePoints.length > 1) {
    const points = curvePoints
    const color = getColor(round.currentMultiplier)
    const currentMs = round.elapsedMs

    if (isVariantMode.value) {
      const jetX = w * JET_X_FRAC
      const curveY = yForMultiplier(round.currentMultiplier, h, maxM)
      const jetY = curveY + playerYOffset

      drawVariantTrail(ctx, points, currentMs, jetX, jetY, color, maxM)

      const pulse = Math.sin(globalTime * (isGauntlet.value ? 0.005 : 0.004))

      if (isGauntlet.value) {
        // Draw items + collide in one pass
        for (const item of gauntletItems) {
          if (item.collected || item.missed) continue
          const itemX = jetX + (item.timeMs - currentMs) * SCROLL_PX_PER_MS
          if (itemX < -20 || itemX > w + 20) continue
          const itemCurveY = yForMultiplier(calcMultiplier(item.timeMs, store.settings.speedFactor), h, maxM)
          const itemY = itemCurveY + item.yOffsetFrac * h
          drawGauntletItem(ctx, item.type, itemX, itemY, item.radius, pulse)

          const dx = jetX - itemX
          const dy = jetY - itemY
          if (Math.sqrt(dx * dx + dy * dy) < item.radius + 16) {
            item.collected = true
            store.applySideGameDelta(item.value)
            sideNetThisRound += item.value
            floatingTexts.push({
              x: itemX,
              y: itemY - 20,
              text: item.value > 0 ? `+${formatCents(item.value)}` : formatCents(item.value),
              color: item.value > 0 ? '#34d399' : '#ef4444',
              life: 0,
              maxLife: 1200
            })
            if (item.value < 0) triggerShake(4, 0.9)
          }
        }

        drawFloatingTexts(ctx, floatingTexts)

        frameCount++
        if (frameCount % 2 === 0) spawnTrailParticle(jetX - 15, jetY, color)
        drawParticles(ctx, particles)

        // Fixed horizontal angle like Scramble/Zaxxon
        drawJet(ctx, jetX, jetY, -0.05, color, 1.6, reducedMotion)

        // Movement range indicator (subtle)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(jetX - 20, curveY - maxPlayerOffset())
        ctx.lineTo(jetX - 20, curveY + maxPlayerOffset())
        ctx.stroke()
        ctx.setLineDash([])

        drawSideNetHud(ctx, w, 'Bonus')
        drawKeyHint(ctx, currentMs, jetX, '↑↓ Arrow keys to steer')
      } else {
        // Jackpot: draw triggers + collide (no collection while a spin runs)
        for (const trigger of jackpotTriggers) {
          if (trigger.collected || trigger.missed) continue
          const tX = jetX + (trigger.timeMs - currentMs) * SCROLL_PX_PER_MS
          if (tX < -20 || tX > w + 20) continue
          const tCurveY = yForMultiplier(calcMultiplier(trigger.timeMs, store.settings.speedFactor), h, maxM)
          const tY = tCurveY + trigger.yOffsetFrac * h
          drawSlotTrigger(ctx, tX, tY, trigger.radius, pulse, trigger.stake)

          if (activeSpin) continue
          const dx = jetX - tX
          const dy = jetY - tY
          if (Math.sqrt(dx * dx + dy * dy) < trigger.radius + 18) {
            if (store.bankroll.balance < trigger.stake) {
              trigger.missed = true
              floatingTexts.push({
                x: tX, y: tY - 20,
                text: `Need ${formatCents(trigger.stake)}`,
                color: '#737373',
                life: 0,
                maxLife: 1200
              })
              continue
            }
            trigger.collected = true
            const reels = rollReels()
            const payout = calcSlotPayout(reels, trigger.stake)
            // Money settles at collection — the reel animation is pure
            // presentation, so unmounting mid-spin can never eat a winning
            // spin's payout. The HUD and floating text still reveal the
            // outcome only when the reels stop.
            store.applySideGameDelta(payout - trigger.stake)
            sideNetThisRound -= trigger.stake
            floatingTexts.push({
              x: tX, y: tY - 20,
              text: `-${formatCents(trigger.stake)} staked`,
              color: '#fbbf24',
              life: 0,
              maxLife: 1400
            })
            activeSpin = {
              phase: 'spinning',
              reels,
              startTime: globalTime,
              stake: trigger.stake,
              payout,
              triggerX: tX,
              triggerY: tY
            }
            // Freeze round time while the reels roll (engine shifts startedAt)
            store.jackpotSpinActive = true
          }
        }

        frameCount++
        if (frameCount % 2 === 0) spawnTrailParticle(jetX - 15, jetY, color)
        drawParticles(ctx, particles)

        drawJet(ctx, jetX, jetY, -0.05, color, 1.6, reducedMotion)
        drawFloatingTexts(ctx, floatingTexts)

        if (activeSpin) drawSlotOverlay(ctx, activeSpin, w, h, globalTime)

        drawSideNetHud(ctx, w, 'Slots net')
        drawKeyHint(ctx, currentMs, jetX + 40, '↑↓ Steer to hit the golden slots')
      }
    } else {
      // ── Classic mode: curve tip at right edge ───────────────────────────
      const maxTime = points[points.length - 1]!.x || 1

      for (const pass of [{ width: 8, alpha: 0.15, blur: 20 }, { width: 3, alpha: 1, blur: 10 }]) {
        ctx.beginPath()
        ctx.lineWidth = pass.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        for (const pt of points) {
          const px = margin + (pt.x / maxTime) * (w - margin * 2)
          const py = yForMultiplier(pt.m, h, maxM)
          if (pt === points[0]) {
            ctx.moveTo(px, py)
          } else {
            ctx.lineTo(px, py)
          }
        }
        ctx.strokeStyle = color
        ctx.globalAlpha = pass.alpha
        ctx.shadowColor = color
        ctx.shadowBlur = pass.blur
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }

      const last = points[points.length - 1]!
      const prev = points[Math.max(0, points.length - 5)]!
      const tipX = margin + (last.x / maxTime) * (w - margin * 2)
      const tipY = yForMultiplier(last.m, h, maxM)
      const prevX = margin + (prev.x / maxTime) * (w - margin * 2)
      const prevY = yForMultiplier(prev.m, h, maxM)
      const angle = Math.atan2(tipY - prevY, tipX - prevX)

      frameCount++
      if (frameCount % 2 === 0) {
        spawnTrailParticle(tipX - Math.cos(angle) * 10, tipY - Math.sin(angle) * 10, color)
      }

      drawParticles(ctx, particles)
      drawJet(ctx, tipX, tipY, angle, color, 1.4, reducedMotion)
    }
  }

  // ── CRASHED state ──────────────────────────────────────────────────────
  if (store.phase === 'CRASHED' && curvePoints.length > 1) {
    const points = curvePoints
    const maxTime = points[points.length - 1]!.x || 1
    const cashedOut = round.cashedOut
    const fadedColor = cashedOut ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'

    if (isVariantMode.value) {
      const finalMs = round.elapsedMs
      const jetX = w * JET_X_FRAC

      ctx.beginPath()
      ctx.lineWidth = 2
      let started = false
      for (const pt of points) {
        const screenX = jetX - (finalMs - pt.x) * SCROLL_PX_PER_MS
        if (screenX < -10 || screenX > w + 10) continue
        const screenY = yForMultiplier(pt.m, h, maxM)
        if (!started) {
          ctx.moveTo(screenX, screenY)
          started = true
        } else {
          ctx.lineTo(screenX, screenY)
        }
      }
      ctx.strokeStyle = fadedColor
      ctx.stroke()

      drawParticles(ctx, particles)
      drawFloatingTexts(ctx, floatingTexts)

      if (isJackpot.value && activeSpin) {
        drawSlotOverlay(ctx, activeSpin, w, h, globalTime)
      }

      drawSideNetHud(ctx, w, isGauntlet.value ? 'Bonus' : 'Slots net')

      if (cashedOut) {
        const curveY = yForMultiplier(round.currentMultiplier, h, maxM)
        ctx.globalAlpha = 0.6
        drawJet(ctx, jetX, curveY + playerYOffset, -0.15, '#34d399', 1.6, reducedMotion)
        ctx.globalAlpha = 1
      }
    } else {
      for (const pass of [{ width: 6, alpha: cashedOut ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)' }, { width: 2, alpha: fadedColor }]) {
        ctx.beginPath()
        ctx.lineWidth = pass.width
        for (const pt of points) {
          const px = margin + (pt.x / maxTime) * (w - margin * 2)
          const py = yForMultiplier(pt.m, h, maxM)
          if (pt === points[0]) {
            ctx.moveTo(px, py)
          } else {
            ctx.lineTo(px, py)
          }
        }
        ctx.strokeStyle = pass.alpha
        ctx.stroke()
      }

      drawParticles(ctx, particles)

      if (cashedOut) {
        const last = points[points.length - 1]!
        const prev = points[Math.max(0, points.length - 5)]!
        const tipX = margin + (last.x / maxTime) * (w - margin * 2)
        const tipY = yForMultiplier(last.m, h, maxM)
        const prevX = margin + (prev.x / maxTime) * (w - margin * 2)
        const prevY = yForMultiplier(prev.m, h, maxM)
        const angle = Math.atan2(tipY - prevY, tipX - prevX)
        ctx.globalAlpha = 0.6
        drawJet(ctx, tipX, tipY, angle, '#34d399', 1.4, reducedMotion)
        ctx.globalAlpha = 1
      }
    }
  }
}

// ── Animation loop ─────────────────────────────────────────────────────────

let rafId: number | null = null
let lastTime = 0
let staticFrameDrawn = false

function renderLoop(time: number = 0) {
  const dt = lastTime ? time - lastTime : 16
  lastTime = time
  globalTime = time

  if (store.phase === 'RUNNING' && store.currentRound) {
    curvePoints.push({
      x: store.currentRound.elapsedMs,
      m: store.currentRound.currentMultiplier
    })

    // Long rounds: thin out old points — the curve is smooth, nobody can tell
    if (curvePoints.length > 2400) {
      curvePoints = curvePoints.filter((_, i) => i % 2 === 0 || i === curvePoints.length - 1)
    }

    if (isGauntlet.value) {
      updateGauntlet(store.currentRound.elapsedMs, dt)
    } else if (isJackpot.value) {
      updateJackpot(store.currentRound.elapsedMs, dt)
    }
  }

  updateParticles(dt)

  // Under reduced motion an idle scene (no round, no effects in flight) is
  // pixel-identical frame to frame — draw it once and skip the rest instead
  // of burning battery repainting a static image. Any state change that can
  // alter the picture resets staticFrameDrawn.
  const isStatic = reducedMotion
    && store.phase !== 'RUNNING'
    && particles.length === 0
    && shakeIntensity === 0
    && !activeSpin
  if (!isStatic || !staticFrameDrawn) {
    draw()
    staticFrameDrawn = isStatic
  }

  rafId = requestAnimationFrame(renderLoop)
}

/**
 * Rebuild the curve when mounting mid-round (navigation back to the game
 * page): sample the multiplier function from 0 to the current elapsed time.
 */
function backfillCurve() {
  const round = store.currentRound
  if (!round || store.phase !== 'RUNNING') return
  curvePoints = []
  const elapsed = Math.max(round.elapsedMs, Date.now() - round.startedAt)
  if (elapsed <= 0) return
  const samples = 240
  for (let i = 0; i <= samples; i++) {
    const t = (elapsed * i) / samples
    curvePoints.push({ x: t, m: calcMultiplier(t, store.settings.speedFactor) })
  }
}

watch(() => store.phase, (phase) => {
  staticFrameDrawn = false
  if (phase === 'RUNNING') {
    curvePoints = []
    particles = []
    frameCount = 0
    if (isVariantMode.value) resetVariantState()
  } else if (phase === 'WAITING') {
    curvePoints = []
    particles = []
  } else if (phase === 'CRASHED') {
    if (curvePoints.length > 1 && !store.currentRound?.cashedOut) {
      const points = curvePoints
      const last = points[points.length - 1]!
      const maxTime = last.x || 1
      const round = store.currentRound
      if (cssW > 0 && round) {
        const maxM = computeMaxM(round)
        let tipX: number, tipY: number
        if (isVariantMode.value) {
          tipX = cssW * JET_X_FRAC
          tipY = yForMultiplier(last.m, cssH, maxM) + playerYOffset
        } else {
          const crashMargin = 40
          tipX = crashMargin + (last.x / maxTime) * (cssW - crashMargin * 2)
          tipY = yForMultiplier(last.m, cssH, maxM)
        }
        spawnCrashBurst(tipX, tipY)
        triggerShake(8, 0.92)
      }
    }
  }
})

// ── Sizing ─────────────────────────────────────────────────────────────────

let resizeObserver: ResizeObserver | null = null

function syncCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  cssW = rect.width
  cssH = rect.height
  dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  stars = makeStars(cssW, cssH)
  wisps = makeWisps(cssW, cssH)
  staticFrameDrawn = false
}

// ── Keyboard (variant steering only) ────────────────────────────────────────

function handleKeyDown(e: KeyboardEvent) {
  if (!isVariantMode.value || store.phase !== 'RUNNING') return
  // Never steer (or preventDefault) while the user is typing in a field —
  // arrows inside a number input are its stepper, not flight controls.
  if (isEditableTarget(e.target)) return
  if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    keysDown.up = true
    e.preventDefault()
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    keysDown.down = true
    e.preventDefault()
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keysDown.up = false
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keysDown.down = false
}

// ── Reduced motion ──────────────────────────────────────────────────────────

let motionQuery: MediaQueryList | null = null

function onMotionPreferenceChange() {
  reducedMotion = motionQuery?.matches ?? false
  staticFrameDrawn = false
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion = motionQuery.matches
  motionQuery.addEventListener('change', onMotionPreferenceChange)

  syncCanvasSize()
  resizeObserver = new ResizeObserver(syncCanvasSize)
  if (canvasRef.value) resizeObserver.observe(canvasRef.value)

  backfillCurve()

  lastTime = 0
  renderLoop()

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  motionQuery?.removeEventListener('change', onMotionPreferenceChange)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    role="img"
    aria-label="Animated multiplier curve. Current value is shown below the chart."
    class="w-full h-full max-h-[400px]"
    style="aspect-ratio: 2/1;"
  />
</template>
