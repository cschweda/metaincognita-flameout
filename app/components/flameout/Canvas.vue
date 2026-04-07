<script setup lang="ts">
import { GAUNTLET_ITEM_DEFS, SLOT_SYMBOLS, SLOT_SYMBOL_COLORS, formatCents } from '~/types/flameout'
import type { GauntletItemType, FloatingText, SlotSymbol, SlotSpinPhase, JackpotTrigger, SlotSpinState } from '~/types/flameout'
import { currentMultiplier as calcMultiplier } from '~/utils/flameout-math'

const store = useFlameoutStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const curvePoints = ref<{ x: number; y: number; m: number }[]>([])

const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
const isGauntlet = computed(() => store.settings.gameMode === 'gauntlet')
const isJackpot = computed(() => store.settings.gameMode === 'jackpot')
const isVariantMode = computed(() => isGauntlet.value || isJackpot.value)

// ── Background starfield ───────────────────────────────────────────────────

interface Star {
  x: number
  y: number
  size: number
  speed: number
  brightness: number
  twinkleOffset: number
  hue: number
}

let stars: Star[] = []
const STAR_COUNT = 140

function initStars(w: number, h: number) {
  stars = []
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 0.4 + Math.random() * 1.8,
      speed: 0.1 + Math.random() * 0.6,
      brightness: 0.3 + Math.random() * 0.7,
      twinkleOffset: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.15 ? 30 + Math.random() * 30 : (200 + Math.random() * 60)
    })
  }
}

// ── Atmospheric nebula wisps ───────────────────────────────────────────────

interface Wisp {
  x: number
  y: number
  rx: number
  ry: number
  speed: number
  opacity: number
  hueShift: number
  phase: number
}

let wisps: Wisp[] = []

function initWisps(w: number, h: number) {
  wisps = []
  for (let i = 0; i < 8; i++) {
    wisps.push({
      x: Math.random() * w * 1.4 - w * 0.2,
      y: Math.random() * h,
      rx: 60 + Math.random() * 180,
      ry: 15 + Math.random() * 50,
      speed: 0.15 + Math.random() * 0.4,
      opacity: 0.015 + Math.random() * 0.04,
      hueShift: Math.random() * 60,
      phase: Math.random() * Math.PI * 2
    })
  }
}

// ── Trail particles ────────────────────────────────────────────────────────

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
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.3
    const speed = 1.5 + Math.random() * 3
    particles.value.push({
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
  particles.value = particles.value.filter((p) => {
    p.life += dt
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.02
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

// ── Screen shake ───────────────────────────────────────────────────────────

let shakeIntensity = 0
let shakeDecay = 0

function triggerShake() {
  shakeIntensity = 8
  shakeDecay = 0.92
}

// ── Colors ─────────────────────────────────────────────────────────────────

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

// ── Jet sprite drawing ─────────────────────────────────────────────────────

function drawJet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, scale: number = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(scale, scale)

  const flicker = 0.8 + Math.random() * 0.4
  const flameLen = 18 * flicker

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

  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.moveTo(14, 0)
  ctx.lineTo(4, -4)
  ctx.lineTo(-6, -5)
  ctx.lineTo(-8, -3)
  ctx.lineTo(-8, 3)
  ctx.lineTo(-6, 5)
  ctx.lineTo(4, 4)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.fillStyle = color
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.moveTo(2, -4); ctx.lineTo(-4, -12); ctx.lineTo(-6, -11); ctx.lineTo(-4, -5)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(2, 4); ctx.lineTo(-4, 12); ctx.lineTo(-6, 11); ctx.lineTo(-4, 5)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = color
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(-6, -5); ctx.lineTo(-10, -9); ctx.lineTo(-10, -7); ctx.lineTo(-8, -3)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.ellipse(8, -1, 3, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ── Background rendering ───────────────────────────────────────────────────

let globalTime = 0

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, multiplier: number, phase: string) {
  const intensity = Math.min((multiplier - 1) / 8, 1)
  const cashedOut = store.currentRound?.cashedOut

  const grad = ctx.createLinearGradient(0, 0, w * 0.3, h)

  if (phase === 'CRASHED' && !cashedOut) {
    grad.addColorStop(0, '#1c0808')
    grad.addColorStop(0.4, '#120610')
    grad.addColorStop(1, '#08080c')
  } else if (phase === 'CRASHED' && cashedOut) {
    grad.addColorStop(0, '#081208')
    grad.addColorStop(0.4, '#06100e')
    grad.addColorStop(1, '#08080c')
  } else {
    const r1 = Math.floor(6 + intensity * 28)
    const g1 = Math.floor(4 + intensity * 4)
    const b1 = Math.floor(22 + intensity * 8)
    const r2 = Math.floor(10 + intensity * 18)
    const g2 = Math.floor(6 + intensity * 2)
    const b2 = Math.floor(28 - intensity * 12)
    grad.addColorStop(0, `rgb(${r1},${g1},${b1})`)
    grad.addColorStop(0.5, `rgb(${r2},${g2},${b2})`)
    grad.addColorStop(1, '#08080e')
  }

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  for (const wisp of wisps) {
    const breathe = 0.7 + 0.3 * Math.sin(globalTime * 0.0008 + wisp.phase)
    const baseHue = 230 + intensity * 40 + wisp.hueShift
    ctx.globalAlpha = wisp.opacity * breathe * (0.6 + intensity * 0.6)
    const wg = ctx.createRadialGradient(wisp.x, wisp.y, 0, wisp.x, wisp.y, wisp.rx)
    wg.addColorStop(0, `hsla(${baseHue}, 70%, 45%, 0.5)`)
    wg.addColorStop(0.4, `hsla(${baseHue + 20}, 50%, 35%, 0.2)`)
    wg.addColorStop(1, 'transparent')
    ctx.fillStyle = wg
    ctx.beginPath()
    ctx.ellipse(wisp.x, wisp.y, wisp.rx, wisp.ry * breathe, 0, 0, Math.PI * 2)
    ctx.fill()
    if (phase === 'RUNNING') {
      wisp.x -= wisp.speed * 0.6
      if (wisp.x + wisp.rx < -20) { wisp.x = w + wisp.rx + 20; wisp.y = Math.random() * h }
    }
  }
  ctx.globalAlpha = 1

  for (const star of stars) {
    const twinkle = 0.4 + 0.6 * Math.sin(globalTime * 0.003 * star.speed + star.twinkleOffset)
    const alpha = star.brightness * twinkle * (0.5 + intensity * 0.5)
    ctx.globalAlpha = alpha
    ctx.fillStyle = `hsl(${star.hue}, 80%, 85%)`
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fill()
    if (star.size > 1.2 && intensity > 0.2) {
      ctx.globalAlpha = alpha * 0.15 * intensity
      ctx.fillStyle = `hsl(${star.hue}, 60%, 70%)`
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size * 4, 0, Math.PI * 2)
      ctx.fill()
    }
    if (phase === 'RUNNING') {
      star.x -= star.speed * 0.4
      if (star.x < -5) { star.x = w + 5; star.y = Math.random() * h }
    }
  }
  ctx.globalAlpha = 1

  if (phase === 'RUNNING' || phase === 'CRASHED') {
    const glowAlpha = 0.03 + intensity * 0.08
    const glowHue = 200 - intensity * 160
    const horizonGrad = ctx.createLinearGradient(0, h, 0, h * 0.5)
    horizonGrad.addColorStop(0, `hsla(${glowHue}, 80%, 40%, ${glowAlpha})`)
    horizonGrad.addColorStop(0.5, `hsla(${glowHue}, 60%, 30%, ${glowAlpha * 0.3})`)
    horizonGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = horizonGrad
    ctx.fillRect(0, 0, w, h)
  }

  const vigR = Math.max(w, h) * 0.8
  const vigGrad = ctx.createRadialGradient(w / 2, h / 2, vigR * 0.35, w / 2, h / 2, vigR)
  vigGrad.addColorStop(0, 'transparent')
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vigGrad
  ctx.fillRect(0, 0, w, h)
}

// ── Gauntlet mode state ────────────────────────────────────────────────────

interface GItem {
  id: number
  type: GauntletItemType
  timeMs: number
  yOffset: number
  value: number
  collected: boolean
  missed: boolean
  radius: number
}

let gauntletItems: GItem[] = []
let floatingTexts: FloatingText[] = []
let playerYOffset = 0
let gauntletBonusTotal = 0
let nextItemId = 0
let lastSpawnMs = 0
const keysDown = { up: false, down: false }
const GAUNTLET_PX_PER_MS = 0.12
const GAUNTLET_JET_X_FRAC = 0.28
const GAUNTLET_SPAWN_BASE_MS = 1400

function resetGauntletState() {
  gauntletItems = []
  floatingTexts = []
  playerYOffset = 0
  gauntletBonusTotal = 0
  nextItemId = 0
  lastSpawnMs = 0
}

function pickItemType(): GauntletItemType {
  const types = Object.entries(GAUNTLET_ITEM_DEFS)
  const totalWeight = types.reduce((a, [, d]) => a + d.weight, 0)
  let roll = Math.random() * totalWeight
  for (const [t, def] of types) {
    roll -= def.weight
    if (roll <= 0) return t as GauntletItemType
  }
  return 'coin'
}

function spawnGauntletItem(currentMs: number) {
  const type = pickItemType()
  const def = GAUNTLET_ITEM_DEFS[type]
  const absMin = Math.min(Math.abs(def.minValue), Math.abs(def.maxValue))
  const absMax = Math.max(Math.abs(def.minValue), Math.abs(def.maxValue))
  const absVal = Math.floor(Math.random() * (absMax - absMin) + absMin)
  const value = (type === 'mine' || type === 'asteroid') ? -absVal : absVal

  gauntletItems.push({
    id: nextItemId++,
    type,
    timeMs: currentMs + 2500 + Math.random() * 2000,
    yOffset: (Math.random() - 0.5) * 240,
    value,
    collected: false,
    missed: false,
    radius: type === 'diamond' ? 14 : type === 'star' ? 13 : 11
  })
}

function updateGauntlet(currentMs: number, dt: number) {
  // Player movement
  const moveSpeed = 4
  if (keysDown.up) playerYOffset -= moveSpeed
  if (keysDown.down) playerYOffset += moveSpeed
  playerYOffset = Math.max(-140, Math.min(140, playerYOffset))

  // Spawn items
  const spawnInterval = GAUNTLET_SPAWN_BASE_MS - Math.min(currentMs / 20, 400)
  if (currentMs - lastSpawnMs > spawnInterval) {
    spawnGauntletItem(currentMs)
    lastSpawnMs = currentMs
  }

  // Clean up old items
  gauntletItems = gauntletItems.filter(item => {
    if (item.collected || item.missed) return item.timeMs > currentMs - 1000
    if (item.timeMs < currentMs - 500) { item.missed = true }
    return true
  })

  // Update floating texts
  floatingTexts = floatingTexts.filter(ft => {
    ft.life += dt
    ft.y -= 0.8
    return ft.life < ft.maxLife
  })
}

function drawGauntletItem(ctx: CanvasRenderingContext2D, type: GauntletItemType, x: number, y: number, radius: number, pulse: number) {
  const def = GAUNTLET_ITEM_DEFS[type]
  const r = radius * (0.9 + 0.1 * pulse)

  ctx.shadowColor = def.glow
  ctx.shadowBlur = 10

  if (type === 'coin') {
    ctx.fillStyle = def.color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#78350f'
    ctx.font = `bold ${Math.round(r)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('$', x, y + 1)
  } else if (type === 'star') {
    ctx.fillStyle = def.color
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2
      const sr = i % 2 === 0 ? r : r * 0.45
      const px = x + Math.cos(a) * sr
      const py = y + Math.sin(a) * sr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  } else if (type === 'diamond') {
    ctx.fillStyle = def.color
    ctx.beginPath()
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r * 0.65, y)
    ctx.lineTo(x, y + r)
    ctx.lineTo(x - r * 0.65, y)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    // Inner shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.moveTo(x, y - r * 0.5)
    ctx.lineTo(x + r * 0.25, y)
    ctx.lineTo(x, y + r * 0.2)
    ctx.lineTo(x - r * 0.25, y)
    ctx.closePath()
    ctx.fill()
  } else if (type === 'mine') {
    ctx.fillStyle = def.color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    // Spikes
    ctx.strokeStyle = '#fca5a5'
    ctx.lineWidth = 2
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * 2 * i) / 4 + Math.PI / 4
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4)
      ctx.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3)
      ctx.stroke()
    }
    // X mark
    const s = r * 0.35
    ctx.beginPath()
    ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s)
    ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s)
    ctx.stroke()
  } else if (type === 'asteroid') {
    ctx.fillStyle = def.color
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8
      const ar = r * (0.7 + 0.3 * Math.sin(i * 3.7 + nextItemId * 0.1))
      const px = x + Math.cos(a) * ar
      const py = y + Math.sin(a) * ar
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    // Crater marks
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.arc(x - r * 0.2, y - r * 0.1, r * 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + r * 0.3, y + r * 0.2, r * 0.15, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.shadowBlur = 0
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D) {
  for (const ft of floatingTexts) {
    const alpha = 1 - ft.life / ft.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = ft.color
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = ft.color
    ctx.shadowBlur = 6
    ctx.fillText(ft.text, ft.x, ft.y)
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1
}

// ── Jackpot mode state ─────────────────────────────────────────────────────

let jackpotTriggers: JackpotTrigger[] = []
let jackpotBonusTotal = 0
let jackpotNextId = 0
let jackpotLastSpawnMs = 0
let activeSpin: SlotSpinState | null = null
const JACKPOT_SPAWN_BASE_MS = 2200
const JACKPOT_JET_X_FRAC = 0.28

function resetJackpotState() {
  jackpotTriggers = []
  jackpotBonusTotal = 0
  jackpotNextId = 0
  jackpotLastSpawnMs = 0
  activeSpin = null
}

function rollReels(): [SlotSymbol, SlotSymbol, SlotSymbol] {
  const pick = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]!
  // 10% chance of triple, 20% chance of double
  const roll = Math.random()
  if (roll < 0.10) {
    const s = pick()
    return [s, s, s]
  }
  if (roll < 0.30) {
    const s = pick()
    const other = pick()
    const pos = Math.floor(Math.random() * 3)
    const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [s, s, s]
    reels[pos === 0 ? 2 : pos === 1 ? 0 : 1] = other === s ? pick() : other
    // Ensure exactly 2 match
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      reels[2] = reels[2] === '7' ? 'star' : '7'
    }
    return reels
  }
  // No match — ensure all different
  let r1 = pick(), r2 = pick(), r3 = pick()
  while (r1 === r2 || r2 === r3 || r1 === r3) {
    r1 = pick(); r2 = pick(); r3 = pick()
  }
  return [r1, r2, r3]
}

function calcSlotPayout(reels: [SlotSymbol, SlotSymbol, SlotSymbol], baseValue: number): number {
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    // Triple match
    return reels[0] === '7' ? baseValue * 25 : baseValue * 10
  }
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    // Double match
    return baseValue * 3
  }
  return 0
}

function spawnJackpotTrigger(currentMs: number) {
  // Base value increases with game progress
  const progressBonus = Math.floor(currentMs / 2000) * 50
  const baseValue = 200 + Math.floor(Math.random() * 300) + progressBonus // $2-$5+ range

  jackpotTriggers.push({
    id: jackpotNextId++,
    timeMs: currentMs + 2800 + Math.random() * 2000,
    yOffset: (Math.random() - 0.5) * 220,
    baseValue,
    collected: false,
    missed: false,
    radius: 16
  })
}

function updateJackpot(currentMs: number, dt: number) {
  // Player movement (same as gauntlet)
  const moveSpeed = 4
  if (keysDown.up) playerYOffset -= moveSpeed
  if (keysDown.down) playerYOffset += moveSpeed
  playerYOffset = Math.max(-140, Math.min(140, playerYOffset))

  // Spawn triggers
  const spawnInterval = JACKPOT_SPAWN_BASE_MS - Math.min(currentMs / 25, 500)
  if (currentMs - jackpotLastSpawnMs > spawnInterval) {
    spawnJackpotTrigger(currentMs)
    jackpotLastSpawnMs = currentMs
  }

  // Clean up old triggers
  jackpotTriggers = jackpotTriggers.filter(t => {
    if (t.collected || t.missed) return t.timeMs > currentMs - 1500
    if (t.timeMs < currentMs - 500) t.missed = true
    return true
  })

  // Update active spin phase
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
      // Apply payout
      if (activeSpin.payout > 0) {
        store.applyGauntletBonus(activeSpin.payout)
        jackpotBonusTotal += activeSpin.payout
        floatingTexts.push({
          x: activeSpin.triggerX,
          y: activeSpin.triggerY - 60,
          text: `+${formatCents(activeSpin.payout)}`,
          color: activeSpin.reels[0] === activeSpin.reels[1] && activeSpin.reels[1] === activeSpin.reels[2] ? '#facc15' : '#34d399',
          life: 0,
          maxLife: 2000
        })
      }
    } else if (activeSpin.phase === 'result' && elapsed > 2500) {
      activeSpin = null
      store.jackpotSpinActive = false
    }
  }

  // Update floating texts
  floatingTexts = floatingTexts.filter(ft => {
    ft.life += dt
    ft.y -= 0.6
    return ft.life < ft.maxLife
  })
}

function drawSlotTrigger(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, pulse: number) {
  const r = radius * (0.92 + 0.08 * pulse)

  // Outer glow
  ctx.shadowColor = '#f59e0b'
  ctx.shadowBlur = 14

  // Golden circle background
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, '#fbbf24')
  grad.addColorStop(0.7, '#f59e0b')
  grad.addColorStop(1, '#b45309')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Inner slot icon: 3 small rectangles
  ctx.fillStyle = '#78350f'
  const slotW = r * 0.3
  const slotH = r * 0.6
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(x + i * (slotW + 1.5) - slotW / 2, y - slotH / 2, slotW, slotH)
  }

  // Question marks in slots
  ctx.fillStyle = '#fbbf24'
  ctx.font = `bold ${Math.round(r * 0.35)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = -1; i <= 1; i++) {
    ctx.fillText('?', x + i * (slotW + 1.5), y + 1)
  }

  // Sparkle ring
  ctx.strokeStyle = 'rgba(251,191,36,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, r + 4 + pulse * 2, 0, Math.PI * 2)
  ctx.stroke()
}

function drawSlotSymbol(ctx: CanvasRenderingContext2D, symbol: SlotSymbol, x: number, y: number, size: number) {
  const color = SLOT_SYMBOL_COLORS[symbol]
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (symbol === '7') {
    ctx.font = `bold ${size}px monospace`
    ctx.fillText('7', x, y)
  } else if (symbol === 'cherry') {
    // Two small circles with stem
    const r = size * 0.25
    ctx.beginPath()
    ctx.arc(x - r, y + r * 0.5, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + r, y + r * 0.5, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - r, y + r * 0.5 - r)
    ctx.quadraticCurveTo(x, y - size * 0.5, x + r, y + r * 0.5 - r)
    ctx.stroke()
  } else if (symbol === 'diamond') {
    const s = size * 0.4
    ctx.beginPath()
    ctx.moveTo(x, y - s)
    ctx.lineTo(x + s * 0.7, y)
    ctx.lineTo(x, y + s)
    ctx.lineTo(x - s * 0.7, y)
    ctx.closePath()
    ctx.fill()
  } else if (symbol === 'bar') {
    const bw = size * 0.6
    const bh = size * 0.25
    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh)
    ctx.fillStyle = '#78350f'
    ctx.font = `bold ${Math.round(size * 0.2)}px monospace`
    ctx.fillText('BAR', x, y + 1)
  } else if (symbol === 'star') {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2
      const sr = i % 2 === 0 ? size * 0.4 : size * 0.18
      const px = x + Math.cos(a) * sr
      const py = y + Math.sin(a) * sr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }
}

function drawSlotOverlay(ctx: CanvasRenderingContext2D, spin: SlotSpinState, w: number, h: number) {
  const cx = w / 2
  const cy = h / 2
  const boxW = 180
  const boxH = 80

  // Darken background
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(0, 0, w, h)

  // Slot machine box
  ctx.fillStyle = '#1a1a2e'
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 2
  const rx = cx - boxW / 2
  const ry = cy - boxH / 2
  ctx.beginPath()
  ctx.roundRect(rx, ry, boxW, boxH, 10)
  ctx.fill()
  ctx.stroke()

  // "JACKPOT" label
  ctx.fillStyle = '#f59e0b'
  ctx.font = 'bold 10px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('JACKPOT SPIN', cx, ry - 8)

  // Three reel slots
  const slotW = 46
  const slotH = 50
  const gap = 8
  const totalW = slotW * 3 + gap * 2
  const startX = cx - totalW / 2

  for (let i = 0; i < 3; i++) {
    const sx = startX + i * (slotW + gap)
    const sy = cy - slotH / 2

    // Slot background
    ctx.fillStyle = '#0f0f23'
    ctx.beginPath()
    ctx.roundRect(sx, sy, slotW, slotH, 4)
    ctx.fill()

    // Determine what to show
    const reelStopped = (
      (i === 0 && (spin.phase === 'stop1' || spin.phase === 'stop2' || spin.phase === 'stop3' || spin.phase === 'result')) ||
      (i === 1 && (spin.phase === 'stop2' || spin.phase === 'stop3' || spin.phase === 'result')) ||
      (i === 2 && (spin.phase === 'stop3' || spin.phase === 'result'))
    )

    if (reelStopped) {
      // Draw the final symbol
      drawSlotSymbol(ctx, spin.reels[i]!, sx + slotW / 2, cy, 28)

      // Flash highlight on match during result
      if (spin.phase === 'result') {
        const isTriple = spin.reels[0] === spin.reels[1] && spin.reels[1] === spin.reels[2]
        const matches = spin.reels[0] === spin.reels[i] || spin.reels[1] === spin.reels[i] || spin.reels[2] === spin.reels[i]
        if (isTriple || (spin.payout > 0 && matches)) {
          ctx.strokeStyle = isTriple ? '#facc15' : '#34d399'
          ctx.lineWidth = 2
          ctx.shadowColor = isTriple ? '#facc15' : '#34d399'
          ctx.shadowBlur = 8
          ctx.beginPath()
          ctx.roundRect(sx, sy, slotW, slotH, 4)
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      }
    } else {
      // Spinning: cycle through random symbols
      const spinIdx = Math.floor(globalTime / 60 + i * 7) % SLOT_SYMBOLS.length
      drawSlotSymbol(ctx, SLOT_SYMBOLS[spinIdx]!, sx + slotW / 2, cy, 28)
      // Blur overlay
      ctx.fillStyle = 'rgba(15,15,35,0.3)'
      ctx.fillRect(sx, sy, slotW, slotH)
    }
  }

  // Payout display during result phase
  if (spin.phase === 'result') {
    const isTriple = spin.reels[0] === spin.reels[1] && spin.reels[1] === spin.reels[2]
    if (spin.payout > 0) {
      ctx.fillStyle = isTriple ? '#facc15' : '#34d399'
      ctx.font = `bold ${isTriple ? 16 : 13}px monospace`
      ctx.textAlign = 'center'
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 10
      ctx.fillText(
        isTriple ? `JACKPOT! +${formatCents(spin.payout)}` : `WIN +${formatCents(spin.payout)}`,
        cx, cy + boxH / 2 + 20
      )
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = '#525252'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('No match', cx, cy + boxH / 2 + 18)
    }
  }
}

// ── Main draw function ─────────────────────────────────────────────────────

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

  if (stars.length === 0) initStars(w, h)
  if (wisps.length === 0) initWisps(w, h)

  // Screen shake
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

  drawBackground(ctx, w, h, multiplier, store.phase)

  if (!round) return

  const maxM = Math.max(round.currentMultiplier * 1.3, store.settings.autoCashoutTarget || 2, 2)
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
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      ctx.fillStyle = `rgba(255,255,255,${0.15 + intensity * 0.1})`
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`${gm}\u00d7`, 4, y - 3)
    }
  }

  // ── Auto-cashout line ──────────────────────────────────────────────────
  if (store.settings.autoCashoutTarget && store.settings.autoCashoutTarget <= maxM * 1.2) {
    const acY = yForMultiplier(store.settings.autoCashoutTarget, h, maxM)
    ctx.strokeStyle = 'rgba(251,191,36,0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(0, acY); ctx.lineTo(w, acY); ctx.stroke()
    ctx.setLineDash([])
  }

  // ── RUNNING phase ──────────────────────────────────────────────────────
  if (store.phase === 'RUNNING' && curvePoints.value.length > 1) {
    const points = curvePoints.value
    const color = getColor(round.currentMultiplier)
    const currentMs = round.elapsedMs

    if (isGauntlet.value) {
      // ── Gauntlet mode: jet at left, items scroll from right ──────────
      const jetX = w * GAUNTLET_JET_X_FRAC
      const curveY = yForMultiplier(round.currentMultiplier, h, maxM)
      const jetY = curveY + playerYOffset

      // Draw curve trail behind jet
      ctx.beginPath()
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      let started = false
      for (const pt of points) {
        const screenX = jetX - (currentMs - pt.x) * GAUNTLET_PX_PER_MS
        if (screenX < -10) continue
        const screenY = yForMultiplier(pt.m, h, maxM)
        if (!started) { ctx.moveTo(screenX, screenY); started = true }
        else ctx.lineTo(screenX, screenY)
      }
      // Line to jet position
      ctx.lineTo(jetX, jetY)
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.stroke()
      ctx.shadowBlur = 0

      // Curve glow
      ctx.beginPath()
      ctx.lineWidth = 8
      started = false
      for (const pt of points) {
        const screenX = jetX - (currentMs - pt.x) * GAUNTLET_PX_PER_MS
        if (screenX < -10) continue
        const screenY = yForMultiplier(pt.m, h, maxM)
        if (!started) { ctx.moveTo(screenX, screenY); started = true }
        else ctx.lineTo(screenX, screenY)
      }
      ctx.lineTo(jetX, jetY)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.12
      ctx.shadowColor = color
      ctx.shadowBlur = 20
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      // Draw gauntlet items
      const pulse = Math.sin(globalTime * 0.005)
      for (const item of gauntletItems) {
        if (item.collected || item.missed) continue
        const itemScreenX = jetX + (item.timeMs - currentMs) * GAUNTLET_PX_PER_MS
        if (itemScreenX < -20 || itemScreenX > w + 20) continue
        const itemCurveY = yForMultiplier(calcMultiplier(item.timeMs, store.settings.speedFactor), h, maxM)
        const itemScreenY = itemCurveY + item.yOffset
        drawGauntletItem(ctx, item.type, itemScreenX, itemScreenY, item.radius, pulse)
      }

      // Collision detection
      for (const item of gauntletItems) {
        if (item.collected || item.missed) continue
        const itemScreenX = jetX + (item.timeMs - currentMs) * GAUNTLET_PX_PER_MS
        const itemCurveY = yForMultiplier(calcMultiplier(item.timeMs, store.settings.speedFactor), h, maxM)
        const itemScreenY = itemCurveY + item.yOffset
        const dx = jetX - itemScreenX
        const dy = jetY - itemScreenY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < item.radius + 16) {
          item.collected = true
          store.applyGauntletBonus(item.value)
          gauntletBonusTotal += item.value
          floatingTexts.push({
            x: itemScreenX,
            y: itemScreenY - 20,
            text: item.value > 0 ? `+${formatCents(item.value)}` : formatCents(item.value),
            color: item.value > 0 ? '#34d399' : '#ef4444',
            life: 0,
            maxLife: 1200
          })
          // Shake on obstacle hit
          if (item.value < 0) {
            shakeIntensity = 4
            shakeDecay = 0.9
          }
        }
      }

      // Draw floating texts
      drawFloatingTexts(ctx)

      // Trail particles
      frameCount++
      if (frameCount % 2 === 0) {
        spawnTrailParticle(jetX - 15, jetY, color)
      }
      drawParticles(ctx)

      // Draw jet — fixed horizontal angle like Scramble/Zaxxon
      drawJet(ctx, jetX, jetY, -0.05, color, 1.6)

      // Movement range indicator (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(jetX - 20, curveY - 140)
      ctx.lineTo(jetX - 20, curveY + 140)
      ctx.stroke()
      ctx.setLineDash([])

      // Bonus total display
      if (gauntletBonusTotal !== 0) {
        ctx.fillStyle = gauntletBonusTotal > 0 ? '#34d399' : '#ef4444'
        ctx.font = 'bold 13px monospace'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = 0.8
        ctx.fillText(
          `Bonus: ${gauntletBonusTotal > 0 ? '+' : ''}${formatCents(gauntletBonusTotal)}`,
          w - 12, 12
        )
        ctx.globalAlpha = 1
      }

      // Arrow key hint
      if (currentMs < 3000) {
        ctx.globalAlpha = Math.max(0, 1 - currentMs / 3000)
        ctx.fillStyle = '#737373'
        ctx.font = '11px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('\u2191\u2193 Arrow keys to steer', jetX, h - 15)
        ctx.globalAlpha = 1
      }

    } else if (isJackpot.value) {
      // ── Jackpot mode: jet at left, slot triggers scroll from right ─────
      const jetX = w * JACKPOT_JET_X_FRAC
      const curveY = yForMultiplier(round.currentMultiplier, h, maxM)
      const jetY = curveY + playerYOffset

      // Draw curve trail behind jet
      ctx.beginPath()
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      let jStarted = false
      for (const pt of points) {
        const screenX = jetX - (currentMs - pt.x) * GAUNTLET_PX_PER_MS
        if (screenX < -10) continue
        const screenY = yForMultiplier(pt.m, h, maxM)
        if (!jStarted) { ctx.moveTo(screenX, screenY); jStarted = true }
        else ctx.lineTo(screenX, screenY)
      }
      ctx.lineTo(jetX, jetY)
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.stroke()
      ctx.shadowBlur = 0

      // Curve glow
      ctx.beginPath()
      ctx.lineWidth = 8
      jStarted = false
      for (const pt of points) {
        const screenX = jetX - (currentMs - pt.x) * GAUNTLET_PX_PER_MS
        if (screenX < -10) continue
        const screenY = yForMultiplier(pt.m, h, maxM)
        if (!jStarted) { ctx.moveTo(screenX, screenY); jStarted = true }
        else ctx.lineTo(screenX, screenY)
      }
      ctx.lineTo(jetX, jetY)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.12
      ctx.shadowColor = color
      ctx.shadowBlur = 20
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      // Draw jackpot triggers
      const pulse = Math.sin(globalTime * 0.004)
      for (const trigger of jackpotTriggers) {
        if (trigger.collected || trigger.missed) continue
        const tScreenX = jetX + (trigger.timeMs - currentMs) * GAUNTLET_PX_PER_MS
        if (tScreenX < -20 || tScreenX > w + 20) continue
        const tCurveY = yForMultiplier(calcMultiplier(trigger.timeMs, store.settings.speedFactor), h, maxM)
        const tScreenY = tCurveY + trigger.yOffset
        drawSlotTrigger(ctx, tScreenX, tScreenY, trigger.radius, pulse)
      }

      // Collision detection (only when no spin active)
      if (!activeSpin) {
        for (const trigger of jackpotTriggers) {
          if (trigger.collected || trigger.missed) continue
          const tScreenX = jetX + (trigger.timeMs - currentMs) * GAUNTLET_PX_PER_MS
          const tCurveY = yForMultiplier(calcMultiplier(trigger.timeMs, store.settings.speedFactor), h, maxM)
          const tScreenY = tCurveY + trigger.yOffset
          const dx = jetX - tScreenX
          const dy = jetY - tScreenY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < trigger.radius + 18) {
            trigger.collected = true
            const reels = rollReels()
            const payout = calcSlotPayout(reels, trigger.baseValue)
            activeSpin = {
              phase: 'spinning',
              reels,
              startTime: globalTime,
              payout,
              triggerX: tScreenX,
              triggerY: tScreenY
            }
            // Suspend crash while spinning
            store.jackpotSpinActive = true
          }
        }
      }

      // Trail particles
      frameCount++
      if (frameCount % 2 === 0) {
        spawnTrailParticle(jetX - 15, jetY, color)
      }
      drawParticles(ctx)

      // Draw jet — fixed horizontal angle like Scramble/Zaxxon
      drawJet(ctx, jetX, jetY, -0.05, color, 1.6)

      // Draw floating texts
      drawFloatingTexts(ctx)

      // Draw slot overlay if active
      if (activeSpin) {
        drawSlotOverlay(ctx, activeSpin, w, h)
      }

      // Bonus total display
      if (jackpotBonusTotal !== 0) {
        ctx.fillStyle = jackpotBonusTotal > 0 ? '#facc15' : '#ef4444'
        ctx.font = 'bold 13px monospace'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = 0.8
        ctx.fillText(
          `Jackpot: +${formatCents(jackpotBonusTotal)}`,
          w - 12, 12
        )
        ctx.globalAlpha = 1
      }

      // Arrow key hint
      if (currentMs < 3000) {
        ctx.globalAlpha = Math.max(0, 1 - currentMs / 3000)
        ctx.fillStyle = '#737373'
        ctx.font = '11px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('\u2191\u2193 Steer to hit the golden slots', jetX + 40, h - 15)
        ctx.globalAlpha = 1
      }

    } else {
      // ── Classic mode: curve tip at right edge ───────────────────────────
      const maxTime = points[points.length - 1]!.x || 1

      // Curve glow
      ctx.beginPath()
      ctx.lineWidth = 8
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const pt of points) {
        const px = margin + (pt.x / maxTime) * (w - margin * 2)
        const py = yForMultiplier(pt.m, h, maxM)
        if (pt === points[0]) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.15
      ctx.shadowColor = color
      ctx.shadowBlur = 20
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      // Main curve
      ctx.beginPath()
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const pt of points) {
        const px = margin + (pt.x / maxTime) * (w - margin * 2)
        const py = yForMultiplier(pt.m, h, maxM)
        if (pt === points[0]) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.stroke()
      ctx.shadowBlur = 0

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

      drawParticles(ctx)
      drawJet(ctx, tipX, tipY, angle, color, 1.4)
    }
  }

  // ── CRASHED state ──────────────────────────────────────────────────────
  if (store.phase === 'CRASHED' && curvePoints.value.length > 1) {
    const points = curvePoints.value
    const maxTime = points[points.length - 1]!.x || 1
    const cashedOut = round.cashedOut

    if (isGauntlet.value) {
      // Gauntlet crashed: show static curve centered on final position
      const finalMs = round.elapsedMs
      const jetX = w * GAUNTLET_JET_X_FRAC

      ctx.beginPath()
      ctx.lineWidth = 2
      let started = false
      for (const pt of points) {
        const screenX = jetX - (finalMs - pt.x) * GAUNTLET_PX_PER_MS
        if (screenX < -10) continue
        if (screenX > w + 10) continue
        const screenY = yForMultiplier(pt.m, h, maxM)
        if (!started) { ctx.moveTo(screenX, screenY); started = true }
        else ctx.lineTo(screenX, screenY)
      }
      ctx.strokeStyle = cashedOut ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'
      ctx.stroke()

      drawParticles(ctx)
      drawFloatingTexts(ctx)

      // Bonus total display
      if (gauntletBonusTotal !== 0) {
        ctx.fillStyle = gauntletBonusTotal > 0 ? '#34d399' : '#ef4444'
        ctx.font = 'bold 13px monospace'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = 0.8
        ctx.fillText(
          `Bonus: ${gauntletBonusTotal > 0 ? '+' : ''}${formatCents(gauntletBonusTotal)}`,
          w - 12, 12
        )
        ctx.globalAlpha = 1
      }

      if (cashedOut) {
        const curveY = yForMultiplier(round.currentMultiplier, h, maxM)
        const jetY = curveY + playerYOffset
        ctx.globalAlpha = 0.6
        drawJet(ctx, jetX, jetY, -0.15, '#34d399', 1.6)
        ctx.globalAlpha = 1
      }
    } else if (isJackpot.value) {
      // Jackpot crashed
      const finalMs = round.elapsedMs
      const jetX = w * JACKPOT_JET_X_FRAC

      ctx.beginPath()
      ctx.lineWidth = 2
      let jcStarted = false
      for (const pt of points) {
        const screenX = jetX - (finalMs - pt.x) * GAUNTLET_PX_PER_MS
        if (screenX < -10 || screenX > w + 10) continue
        const screenY = yForMultiplier(pt.m, h, maxM)
        if (!jcStarted) { ctx.moveTo(screenX, screenY); jcStarted = true }
        else ctx.lineTo(screenX, screenY)
      }
      ctx.strokeStyle = cashedOut ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'
      ctx.stroke()

      drawParticles(ctx)
      drawFloatingTexts(ctx)

      // Show slot overlay if still spinning at crash time
      if (activeSpin) {
        drawSlotOverlay(ctx, activeSpin, w, h)
      }

      // Jackpot total display
      if (jackpotBonusTotal > 0) {
        ctx.fillStyle = '#facc15'
        ctx.font = 'bold 13px monospace'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = 0.8
        ctx.fillText(`Jackpot: +${formatCents(jackpotBonusTotal)}`, w - 12, 12)
        ctx.globalAlpha = 1
      }

      if (cashedOut) {
        const curveY = yForMultiplier(round.currentMultiplier, h, maxM)
        const jetY = curveY + playerYOffset
        ctx.globalAlpha = 0.6
        drawJet(ctx, jetX, jetY, -0.15, '#34d399', 1.6)
        ctx.globalAlpha = 1
      }
    } else {
      // Classic crashed
      ctx.beginPath()
      ctx.lineWidth = 6
      for (const pt of points) {
        const px = margin + (pt.x / maxTime) * (w - margin * 2)
        const py = yForMultiplier(pt.m, h, maxM)
        if (pt === points[0]) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = cashedOut ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)'
      ctx.stroke()

      ctx.beginPath()
      ctx.lineWidth = 2
      for (const pt of points) {
        const px = margin + (pt.x / maxTime) * (w - margin * 2)
        const py = yForMultiplier(pt.m, h, maxM)
        if (pt === points[0]) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = cashedOut ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'
      ctx.stroke()

      drawParticles(ctx)

      if (cashedOut) {
        const last = points[points.length - 1]!
        const prev = points[Math.max(0, points.length - 5)]!
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
}

// ── Animation loop ─────────────────────────────────────────────────────────

let rafId: number | null = null
let lastTime = 0

function renderLoop(time: number = 0) {
  const dt = lastTime ? time - lastTime : 16
  lastTime = time
  globalTime = time

  if (store.phase === 'RUNNING' && store.currentRound) {
    curvePoints.value.push({
      x: store.currentRound.elapsedMs,
      y: 0,
      m: store.currentRound.currentMultiplier
    })

    // Update variant state
    if (isGauntlet.value) {
      updateGauntlet(store.currentRound.elapsedMs, dt)
    } else if (isJackpot.value) {
      updateJackpot(store.currentRound.elapsedMs, dt)
    }
  }

  updateParticles(dt)
  draw()

  rafId = requestAnimationFrame(renderLoop)
}

watch(() => store.phase, (phase) => {
  if (phase === 'RUNNING') {
    curvePoints.value = []
    particles.value = []
    frameCount = 0
    if (isGauntlet.value) resetGauntletState()
    if (isJackpot.value) resetJackpotState()
  } else if (phase === 'WAITING') {
    curvePoints.value = []
    particles.value = []
  } else if (phase === 'CRASHED') {
    if (curvePoints.value.length > 1 && !store.currentRound?.cashedOut) {
      const points = curvePoints.value
      const last = points[points.length - 1]!
      const maxTime = last.x || 1
      const canvas = canvasRef.value
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const crashMargin = 40
        const w = rect.width
        const h = rect.height
        const maxM = Math.max((store.currentRound?.currentMultiplier || 2) * 1.3, 2)

        let tipX: number, tipY: number
        if (isGauntlet.value) {
          tipX = w * GAUNTLET_JET_X_FRAC
          tipY = yForMultiplier(last.m, h, maxM) + playerYOffset
        } else if (isJackpot.value) {
          tipX = w * JACKPOT_JET_X_FRAC
          tipY = yForMultiplier(last.m, h, maxM) + playerYOffset
        } else {
          tipX = crashMargin + (last.x / maxTime) * (w - crashMargin * 2)
          tipY = yForMultiplier(last.m, h, maxM)
        }
        spawnCrashBurst(tipX, tipY)
        triggerShake()
      }
    }
  }
})

// ── Keyboard handling ──────────────────────────────────────────────────────

function handleKeyDown(e: KeyboardEvent) {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { keysDown.up = true; e.preventDefault() }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { keysDown.down = true; e.preventDefault() }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keysDown.up = false
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keysDown.down = false
}

onMounted(() => {
  lastTime = 0
  renderLoop()

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', () => {
    const canvas = canvasRef.value
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      initStars(rect.width, rect.height)
      initWisps(rect.width, rect.height)
    }
  })
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="w-full h-full max-h-[400px]"
    style="aspect-ratio: 2/1;"
  />
</template>
