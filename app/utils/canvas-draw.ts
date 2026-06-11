/**
 * Pure canvas rendering helpers for the Flameout game canvas.
 * No store access, no component state — everything is passed in.
 */

import { GAUNTLET_ITEM_DEFS, SLOT_SYMBOLS, SLOT_SYMBOL_COLORS, formatCents } from '~/types/flameout'
import type { GauntletItemType, FloatingText, SlotSymbol, SlotSpinState } from '~/types/flameout'

// ── Scene scaffolding ───────────────────────────────────────────────────────

export interface Star {
  x: number
  y: number
  size: number
  speed: number
  brightness: number
  twinkleOffset: number
  hue: number
}

export interface Wisp {
  x: number
  y: number
  rx: number
  ry: number
  speed: number
  opacity: number
  hueShift: number
  phase: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

export function makeStars(w: number, h: number, count = 140): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
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
  return stars
}

export function makeWisps(w: number, h: number): Wisp[] {
  const wisps: Wisp[] = []
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
  return wisps
}

// ── Coordinate + color helpers ──────────────────────────────────────────────

export function getColor(multiplier: number): string {
  if (multiplier >= 10) return '#ef4444'
  if (multiplier >= 5) return '#f97316'
  if (multiplier >= 3) return '#f59e0b'
  if (multiplier >= 2) return '#eab308'
  return '#34d399'
}

export function yForMultiplier(m: number, height: number, maxM: number): number {
  const margin = 20
  const usable = height - margin * 2
  const logMax = Math.log(Math.max(maxM, 1.5))
  const logM = Math.log(Math.max(m, 1))
  return height - margin - (logM / logMax) * usable
}

// ── Background ──────────────────────────────────────────────────────────────

export interface BackgroundOptions {
  multiplier: number
  phase: string
  cashedOut: boolean
  globalTime: number
  /** Stars/wisps scroll leftward (RUNNING only) */
  drift: boolean
  /** Static sky, no twinkle/drift */
  reducedMotion: boolean
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: BackgroundOptions,
  stars: Star[],
  wisps: Wisp[]
) {
  const { multiplier, phase, cashedOut, globalTime, drift, reducedMotion } = opts
  const intensity = Math.min((multiplier - 1) / 8, 1)

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
    const breathe = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(globalTime * 0.0008 + wisp.phase)
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
    if (drift && !reducedMotion) {
      wisp.x -= wisp.speed * 0.6
      if (wisp.x + wisp.rx < -20) {
        wisp.x = w + wisp.rx + 20
        wisp.y = Math.random() * h
      }
    }
  }
  ctx.globalAlpha = 1

  for (const star of stars) {
    const twinkle = reducedMotion ? 0.8 : 0.4 + 0.6 * Math.sin(globalTime * 0.003 * star.speed + star.twinkleOffset)
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
    if (drift && !reducedMotion) {
      star.x -= star.speed * 0.4
      if (star.x < -5) {
        star.x = w + 5
        star.y = Math.random() * h
      }
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

// ── Sprites ─────────────────────────────────────────────────────────────────

export function drawJet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  scale = 1,
  reducedMotion = false
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(scale, scale)

  const flicker = reducedMotion ? 1 : 0.8 + Math.random() * 0.4
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

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.ellipse(8, -1, 3, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

export function drawGauntletItem(
  ctx: CanvasRenderingContext2D,
  type: GauntletItemType,
  x: number,
  y: number,
  radius: number,
  pulse: number
) {
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
    ctx.moveTo(x - s, y - s)
    ctx.lineTo(x + s, y + s)
    ctx.moveTo(x + s, y - s)
    ctx.lineTo(x - s, y + s)
    ctx.stroke()
  } else if (type === 'asteroid') {
    ctx.fillStyle = def.color
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8
      const ar = r * (0.7 + 0.3 * Math.sin(i * 3.7))
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

export function drawSlotTrigger(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  pulse: number,
  stake: number
) {
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

  // Stake price tag — the spin costs this much
  ctx.fillStyle = 'rgba(251,191,36,0.85)'
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(formatCents(stake), x, y + r + 6)
}

export function drawSlotSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: SlotSymbol,
  x: number,
  y: number,
  size: number
) {
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

export function drawSlotOverlay(
  ctx: CanvasRenderingContext2D,
  spin: SlotSpinState,
  w: number,
  h: number,
  globalTime: number
) {
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

  // Labels
  ctx.fillStyle = '#f59e0b'
  ctx.font = 'bold 10px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(`JACKPOT SPIN — STAKE ${formatCents(spin.stake)}`, cx, ry - 8)

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

    const reelStopped = (
      (i === 0 && (spin.phase === 'stop1' || spin.phase === 'stop2' || spin.phase === 'stop3' || spin.phase === 'result'))
      || (i === 1 && (spin.phase === 'stop2' || spin.phase === 'stop3' || spin.phase === 'result'))
      || (i === 2 && (spin.phase === 'stop3' || spin.phase === 'result'))
    )

    if (reelStopped) {
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
      ctx.fillStyle = '#737373'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('No match — stake lost', cx, cy + boxH / 2 + 18)
    }
  }
}

// ── Effects ─────────────────────────────────────────────────────────────────

export function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]) {
  for (const ft of texts) {
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

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
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
