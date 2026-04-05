# Flameout — Complete Design Document Suite

## Metaincognita Casino Simulator Suite

---

# Doc 01: Headless Core Engine

## 1. Overview

The Flameout headless core engine is the mathematical and state-management brain of the simulator. It runs entirely independent of any rendering layer and can execute rounds in instant/batch mode for strategy simulation or in real-time mode for animated gameplay. Every other layer of the application — rendering, UI, analytics — consumes the engine's reactive state through the Pinia store.

## 2. Crash Point Generation

### 2.1 The Core RNG Function

```typescript
function generateCrashPoint(houseEdgePercent: number): number {
  const r = 1 - houseEdgePercent / 100 // RTP as decimal, e.g. 0.97
  const R = Math.random()              // Uniform random in [0, 1)

  // Instant crash check: occurs with probability equal to house edge
  if (R < (1 - r)) return 1.00

  // Inverse distribution: produces the correct P(crash >= m) = r/m
  const crashPoint = Math.floor((100 * r) / (1 - R)) / 100

  // Floor to 1.00 minimum (safety)
  return Math.max(1.00, crashPoint)
}
```

### 2.2 Distribution Verification

The engine must include a self-test function that generates N crash points (default 1,000,000) and verifies:

- Percentage of instant crashes (1.00×) ≈ house edge within ±0.5%.
- Percentage reaching 2.00× ≈ `RTP / 2` within ±1%.
- Percentage reaching 10.00× ≈ `RTP / 10` within ±1%.
- Mean payout across all crash points ≈ `1 / (1 - RTP)` within expected statistical bounds.

This is a unit-testable function and should be exercised in the test suite.

### 2.3 Seeded RNG (Optional)

For reproducible strategy comparison, the engine should support an optional seed-based PRNG (e.g., a simple mulberry32 or xoshiro128 implementation) so that two strategy simulations can run against the identical sequence of crash points.

## 3. Round State Machine

```
┌──────────┐     bet placed     ┌──────────┐    crash point    ┌──────────┐     settled     ┌──────────┐
│ WAITING  │ ──────────────────▶ │ RUNNING  │ ──────────────▶  │ CRASHED  │ ──────────────▶ │ SETTLING │
│ (betting │     timer expires   │ (multi-  │   or player      │          │    bankroll     │          │
│  window) │     auto-start     │  plier   │   cashes out     │          │    updated      │          │
└──────────┘                     │  rising) │                  └──────────┘                 └──┬───────┘
     ▲                           └──────────┘                                                  │
     │                                                                                         │
     └─────────────────────────────────────────────────────────────────────────────────────────┘
                                              next round
```

### 3.1 State Definitions

| State | Duration | Player Actions | Engine Activity |
|---|---|---|---|
| WAITING | Configurable (default 5s) | Place bet, set auto-cashout, toggle auto-bet | Countdown timer, accept bet input |
| RUNNING | Variable (until crash) | Press cash-out button | Increment displayed multiplier, check for auto-cashout trigger, check for crash point reached |
| CRASHED | Instant | None | Freeze multiplier, emit crash event |
| SETTLING | Brief (~500ms) | None | Calculate payout, update bankroll, record round history, transition to WAITING |

### 3.2 Multiplier Tick Rate

During the RUNNING phase, the multiplier must increment smoothly for display purposes. The engine calculates the target crash point at round start and simulates the multiplier's rise on each animation frame or tick:

```typescript
// Elapsed time in seconds since round start
// Multiplier curve: starts slow, accelerates (exponential feel)
function currentMultiplier(elapsedMs: number, speedFactor: number = 1): number {
  const t = (elapsedMs / 1000) * speedFactor
  // Exponential growth model: multiplier = e^(growth * t)
  // Growth rate calibrated so 2.00x is reached in ~5 seconds at 1x speed
  const growthRate = 0.15
  return Math.floor(Math.exp(growthRate * t) * 100) / 100
}
```

The engine checks on each tick whether `currentMultiplier >= crashPoint`. When true, the round transitions to CRASHED.

### 3.3 Cash-Out Processing

```typescript
interface CashOutResult {
  success: boolean
  multiplier: number
  betAmount: number
  payout: number    // betAmount * multiplier
  profit: number    // payout - betAmount
}
```

Cash-out is valid only during the RUNNING state and only if the current displayed multiplier has not yet reached the crash point. The auto-cashout system checks on each tick whether the current multiplier has reached or exceeded the configured target.

## 4. Bankroll Management

```typescript
interface BankrollState {
  balance: number           // Current balance
  initialBalance: number    // Starting balance for session
  peakBalance: number       // Highest balance achieved
  totalWagered: number      // Sum of all bets placed
  totalReturned: number     // Sum of all payouts received
  roundsPlayed: number
  roundsWon: number
  roundsLost: number
  currentStreak: number     // Positive = wins, negative = losses
  longestWinStreak: number
  longestLossStreak: number
}
```

Bankroll is updated during the SETTLING phase. If balance reaches zero, the engine enters a BUSTED state and offers a re-buy option (reset to initial balance or custom amount).

## 5. Round History

Each completed round is recorded:

```typescript
interface RoundRecord {
  id: number
  crashPoint: number
  bet: number
  cashoutMultiplier: number | null  // null = did not cash out
  payout: number
  profit: number
  balanceAfter: number
  timestamp: number
}
```

History is stored in the Pinia store and persisted to `localStorage`. The last 1,000 rounds are retained; older rounds are summarized into aggregate statistics.

## 6. Configurable Parameters

| Parameter | Type | Default | Range |
|---|---|---|---|
| `houseEdgePercent` | number | 3 | 0.5 – 10 |
| `startingBankroll` | number | 1000 | 100 – 1,000,000 |
| `minBet` | number | 0.10 | 0.01 – 100 |
| `maxBet` | number | 1000 | 10 – 100,000 |
| `bettingWindowMs` | number | 5000 | 1000 – 15000 |
| `speedFactor` | number | 1 | 0.5 – 10 |
| `autoCashoutTarget` | number or null | null | 1.01 – 10000 |

## 7. Batch Simulation Mode

For the Strategy Lab, the engine must support running N rounds instantly (no animation, no delays) with a given betting system configuration. The batch runner accepts:

```typescript
interface BatchSimConfig {
  rounds: number                // Number of rounds to simulate
  houseEdgePercent: number
  startingBankroll: number
  strategy: StrategyConfig      // See Doc 01 Section 8
  seed?: number                 // Optional reproducible seed
}

interface BatchSimResult {
  finalBalance: number
  peakBalance: number
  troughBalance: number
  roundsPlayed: number          // May be < rounds if busted
  roundsWon: number
  roundsLost: number
  totalWagered: number
  totalReturned: number
  empiricalRTP: number          // totalReturned / totalWagered
  busted: boolean
  bustedAtRound: number | null
  balanceCurve: number[]        // Balance after each round
}
```

## 8. Strategy Definitions

```typescript
type StrategyType = 'flat' | 'martingale' | 'dalembert' | 'fibonacci' | 'paroli'

interface StrategyConfig {
  type: StrategyType
  baseBet: number
  cashoutTarget: number
  maxBet?: number               // Cap for progressive systems
}
```

Strategy logic for each type:

- **Flat**: Bet `baseBet` every round. No progression.
- **Martingale**: Double bet after each loss. Reset to `baseBet` after each win. Cap at `maxBet`.
- **D'Alembert**: Increase bet by `baseBet` after loss. Decrease by `baseBet` after win. Floor at `baseBet`.
- **Fibonacci**: Follow Fibonacci sequence (1, 1, 2, 3, 5, 8…) × `baseBet` on losses. Step back two positions on win.
- **Paroli** (Reverse Martingale): Double bet after each win (up to 3 consecutive wins). Reset to `baseBet` after loss or after 3 wins.

## 9. Testing Checklist

- [ ] Crash point distribution matches theoretical probabilities (±1% over 100K rounds).
- [ ] Instant crash frequency matches house edge setting (±0.5% over 100K rounds).
- [ ] Empirical RTP converges to configured RTP (±0.5% over 100K rounds).
- [ ] Round state machine transitions correctly through all four states.
- [ ] Cash-out during RUNNING succeeds; cash-out during other states fails silently.
- [ ] Auto-cashout triggers at correct multiplier (±0.01×).
- [ ] Bankroll arithmetic is exact (no floating-point drift — use integer cents internally).
- [ ] Batch simulation produces identical results with same seed.
- [ ] All five strategy types produce correct bet progression sequences.
- [ ] Bust detection triggers when balance < minBet.

---

# Doc 02: Rendering & Animation

## 1. Overview

Flameout's rendering layer draws the rising multiplier curve and sprite animation on an HTML `<canvas>` element. It is deliberately minimal — no game engine, no WebGL, no external animation library. The entire renderer is a single composable (`useFlameoutRenderer`) that accepts a canvas ref and consumes engine state from the Pinia store.

## 2. Canvas Setup

```typescript
// Canvas dimensions: responsive, high-DPI aware
const CANVAS_BASE_WIDTH = 800
const CANVAS_BASE_HEIGHT = 400
const DPR = window.devicePixelRatio || 1

function initCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * DPR
  canvas.height = rect.height * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)
  return ctx
}
```

The canvas is sized via CSS to fill its container (responsive), and the internal pixel dimensions are scaled by the device pixel ratio for crisp rendering on Retina/HiDPI displays.

## 3. Coordinate System

The canvas uses a transformed coordinate system where:

- X-axis = elapsed time (left to right, 0 to current elapsed).
- Y-axis = multiplier value (bottom to top, 1.00× at bottom, scaling dynamically as multiplier grows).

The Y-axis uses a logarithmic or semi-logarithmic scale so that the visual acceleration of the curve feels dramatic without the early low-multiplier phase looking flat.

## 4. Curve Drawing

The multiplier curve is the primary visual element. It is drawn as a continuous path from the origin to the current multiplier position.

```
ctx.beginPath()
ctx.moveTo(marginLeft, yForMultiplier(1.00))
for each recorded tick (time, multiplier):
    ctx.lineTo(xForTime(time), yForMultiplier(multiplier))
ctx.strokeStyle = curveColor   // gradient from cool to hot as multiplier rises
ctx.lineWidth = 3
ctx.stroke()
```

The curve color transitions from a cool blue/teal at low multipliers through green, yellow, and into orange/red as the multiplier climbs. This provides visceral visual feedback without adding complexity.

## 5. Sprite

The Flameout sprite is a stylized jet flame/afterburner positioned at the tip of the curve. Implementation options (in order of preference):

1. **Pre-rendered PNG sprite sheet** with 2-3 animation frames for a flickering flame effect. Drawn at the curve tip using `ctx.drawImage()`, rotated to match the curve's tangent angle.
2. **Simple SVG flame** rendered to an offscreen canvas once, then stamped at the curve tip each frame.
3. **Procedural flame**: A small canvas-drawn shape (3-4 overlapping circles with radial gradients in orange/yellow/white) that wobbles slightly frame-to-frame.

On crash: the sprite triggers a burst animation (expanding circle + scatter particles) and fades out over ~300ms.

## 6. Particle System

A lightweight particle system (no library) for two effects:

**Trail particles**: During RUNNING, 1-2 particles per frame are spawned at the sprite's position, with slight random velocity, fading opacity, and shrinking size over 500ms lifetime. Colors match the flame palette. Maximum 30 active particles at any time.

**Crash particles**: On crash, 20-30 particles burst from the sprite's last position with radial velocity, red/orange coloring, and 800ms lifetime.

```typescript
interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  color: string
}
```

## 7. Grid and Labels

Behind the curve, a subtle grid provides reference:

- Horizontal lines at key multiplier values (1×, 2×, 5×, 10×, 20×, 50×, 100×) with labels on the Y-axis.
- Vertical lines at time intervals.
- Grid color: very faint, dark-mode friendly (e.g., `rgba(255,255,255,0.06)`).
- Current multiplier displayed in large, bold text in the center-top of the canvas, updating each frame.

## 8. Crash Animation Sequence

When the crash point is reached:

1. Frame 0: Curve drawing stops. Multiplier text turns red.
2. Frames 0-5 (~80ms): Sprite scales up 1.5× with a white flash overlay.
3. Frames 5-20 (~250ms): Sprite explodes outward (crash particle burst). Sprite fades out.
4. Frames 20-40 (~330ms): Particles drift and fade. Canvas dims slightly (overlay with 10% black opacity).
5. Final state: Static display showing the crash point in large red text. Holds until next round.

## 9. Performance Budget

Target: 60fps on mid-range mobile (2020-era smartphone). The renderer must:

- Skip particle updates when tab is not visible (`document.hidden`).
- Throttle to 30fps when battery is low (if Battery API available).
- Use `requestAnimationFrame` exclusively (no `setInterval`).
- Clear only the dirty region of the canvas when possible (though full-clear is acceptable given the small canvas size).

## 10. Dark Mode / Theming

The canvas respects the application's dark/light mode via CSS custom properties read at render time:

- Background: transparent (the canvas sits on the page background).
- Curve color: theme-adaptive gradient.
- Grid: theme-adaptive opacity.
- Multiplier text: white (dark mode) or dark gray (light mode).

## 11. Testing Checklist

- [ ] Canvas renders at correct DPI on standard and Retina displays.
- [ ] Curve draws smoothly at 60fps with no visible stutter.
- [ ] Sprite tracks curve tip accurately, including rotation.
- [ ] Crash animation sequence plays completely and returns to idle state.
- [ ] Trail particles stay within performance budget (≤30 active).
- [ ] Canvas resizes correctly on window resize / orientation change.
- [ ] Rendering is idle (no rAF loop) when game is in WAITING/SETTLING states.

---

# Doc 03: Game UI & Controls

## 1. Overview

The game UI wraps the canvas with Nuxt UI v4 components: bet controls, cash-out button, auto-cashout configuration, round history strip, and settings. The UI must be responsive (desktop and mobile), touch-friendly, and accessible.

## 2. Layout

### Desktop (≥768px)

```
┌─────────────────────────────────────────────────────────┐
│  Header: Flameout logo / title        Settings ⚙  Help │
├──────────────────────────────────┬──────────────────────┤
│                                  │  Session Stats       │
│        Game Canvas               │  (compact panel)     │
│        (responsive, ~60% width)  │                      │
│                                  │  Round History       │
│                                  │  (scrollable list)   │
├──────────────────────────────────┴──────────────────────┤
│  Controls Bar:                                          │
│  [Bet Input] [½] [2×] [Max]  [Auto-Cashout: ___×]     │
│  [ CASH OUT / PLACE BET ]     [Auto-Bet ☐]             │
├─────────────────────────────────────────────────────────┤
│  History Strip: [1.42×] [3.81×] [1.00×] [12.7×] ...   │
└─────────────────────────────────────────────────────────┘
```

### Mobile (<768px)

Canvas stacked full-width on top, controls directly below, history strip horizontal-scrollable below controls, stats collapsed into a toggle-open drawer.

## 3. Component Specifications

### 3.1 Bet Input (`FlameoutBetInput.vue`)

- Numeric input field with currency formatting (e.g., `$10.00`).
- Preset buttons: ½ (halve), 2× (double), Max (set to maximum allowed or balance).
- Validation: min/max bet enforcement, insufficient balance warning.
- Disabled during RUNNING and CRASHED states.

### 3.2 Cash-Out / Place Bet Button (`FlameoutActionButton.vue`)

This is the most important interactive element in the game. It changes function by state:

| State | Button Label | Color | Action |
|---|---|---|---|
| WAITING | "Place Bet ($X.XX)" | Green | Submit bet for upcoming round |
| RUNNING | "Cash Out (X.XX×)" | Pulsing amber/gold | Cash out at current multiplier |
| CRASHED | "— Crashed at X.XX× —" | Red, disabled | No action |
| SETTLING | "Next Round..." | Gray, disabled | No action |

The cash-out button during RUNNING must update its label in real time to show the current multiplier. It must be large (minimum 48px tap target on mobile), high-contrast, and impossible to miss.

### 3.3 Auto-Cashout (`FlameoutAutoCashout.vue`)

- Numeric input: target multiplier (e.g., `2.00×`).
- Toggle to enable/disable.
- When enabled, engine automatically cashes out if multiplier reaches target.
- Visual indicator on the canvas: a horizontal dashed line at the auto-cashout level.

### 3.4 Auto-Bet Toggle

- Checkbox or toggle switch.
- When enabled, automatically places the same bet at the start of each new round.
- Combined with auto-cashout, this allows fully automated play for observation/simulation.

### 3.5 Round History Strip (`FlameoutHistory.vue`)

- Horizontal strip of crash point badges, most recent on the left.
- Color coding: green (≥2.00×), yellow (1.50×–1.99×), orange (1.20×–1.49×), red (<1.20×), bright red pulsing (1.00× instant crash).
- Last 30 rounds visible; horizontally scrollable for more.
- Tap/click a badge to see round details (bet, cashout, payout).

### 3.6 Session Stats Panel (`FlameoutStats.vue`)

Compact panel showing:

- Balance (with profit/loss delta from starting balance)
- Rounds played / won / lost
- Win rate percentage
- Total wagered / Total returned
- Empirical RTP this session
- Current streak
- Peak balance / Max drawdown

### 3.7 Settings Panel (`FlameoutSettings.vue`)

Modal or slide-out drawer:

- House edge selector: preset buttons (1%, 3%, 5%) and custom input.
- Starting bankroll input.
- Speed control: slider (0.5× to 5×) and "Instant" mode toggle.
- Reset session button (confirmation dialog).
- Sound toggle (if sound effects are implemented).
- Theme override (system / dark / light).

## 4. Keyboard Shortcuts

| Key | Action |
|---|---|
| Space | Place bet (WAITING) or Cash out (RUNNING) |
| Escape | Cancel auto-bet |
| 1-9 | Quick-bet presets ($1, $5, $10, $25, $50, $100, $250, $500, $1000) |

## 5. Accessibility

- All controls labeled with `aria-label` or associated `<label>`.
- Cash-out button announces state changes via `aria-live="polite"`.
- Color is never the sole indicator — crash points include text values alongside color badges.
- Tab navigation follows logical order: bet input → action button → auto-cashout → auto-bet.
- Reduced motion preference: disable particle effects and curve animation, show static multiplier updates instead.

## 6. Testing Checklist

- [ ] All controls function correctly in each game state.
- [ ] Bet input validates min/max and balance constraints.
- [ ] Cash-out button updates label in real time during RUNNING.
- [ ] Auto-cashout triggers correctly at the target multiplier.
- [ ] Auto-bet + auto-cashout runs consecutive rounds hands-free.
- [ ] History strip populates correctly and scrolls.
- [ ] Layout is responsive at 320px, 768px, 1024px, and 1440px widths.
- [ ] Keyboard shortcuts work as specified.
- [ ] Screen reader announces state transitions correctly.

---

# Doc 04: Analytics & Education Layer

## 1. Overview

The analytics layer is Flameout's differentiator. Commercial crash games are designed to keep players betting. Flameout is designed to help players *understand* why the house always wins. This document specifies the educational tools that transform a simple game into a probability teaching instrument.

## 2. Probability Explorer (`FlameoutProbability.vue`)

An interactive calculator where the user enters a target multiplier and sees:

- **P(reaching it)**: e.g., "At 97% RTP, the probability of reaching 3.00× is 32.33%."
- **Implied odds**: e.g., "Roughly 1 in 3.1 rounds."
- **Expected profit per dollar**: e.g., "Win $3.00 with probability 32.33%, lose $1.00 with probability 67.67%. EV = −$0.03."
- **Break-even probability**: e.g., "You would need to win 33.33% of the time to break even at 3.00×, but you only win 32.33%. The gap is the house edge."

The explorer should include a slider for the multiplier (1.01× to 100×) with the probability chart updating in real time.

## 3. EV Invariance Demonstrator (`FlameoutEVDemo.vue`)

The crown jewel of the education layer. This tool runs two (or more) auto-cashout strategies side-by-side over the same sequence of crash points and shows that they converge to the same loss rate.

Setup:
- User configures 2-4 strategies (e.g., "Conservative 1.50×", "Moderate 3.00×", "Aggressive 10.00×").
- User clicks "Run 1,000 Rounds."
- The system generates one sequence of crash points and applies each strategy against it.

Display:
- Line chart: bankroll curves for each strategy, overlaid.
- Table: final balance, empirical RTP, win rate, peak, trough for each strategy.
- Annotation: "Despite dramatically different win rates and volatility, all strategies produced approximately the same net loss: ~3% of total wagered."

This is the single most important educational moment in Flameout. The visual of divergent-then-convergent bankroll curves powerfully demonstrates EV invariance.

## 4. Crash Point Distribution Chart (`FlameoutDistribution.vue`)

A histogram of observed crash points from the current session, with the theoretical distribution overlaid as a curve. As more rounds are played, the empirical distribution converges toward the theoretical curve — a live demonstration of the law of large numbers.

Bins: 1.00–1.20, 1.20–1.50, 1.50–2.00, 2.00–3.00, 3.00–5.00, 5.00–10.00, 10.00–50.00, 50.00+.

## 5. Streak Analysis (`FlameoutStreaks.vue`)

Tracks and displays:

- Current win/loss streak.
- Longest win streak and loss streak in session.
- Distribution of streak lengths vs. expected distribution.
- Conditional probability display: "After 5 consecutive crashes below 2.00×, the probability of the next round reaching 2.00× is: 48.5%. Exactly the same as always."

This directly combats the gambler's fallacy with empirical evidence.

## 6. Strategy Lab (`FlameoutStrategyLab.vue`)

A full batch simulation interface:

1. Configure strategy type (Flat, Martingale, D'Alembert, Fibonacci, Paroli).
2. Set parameters: base bet, cashout target, max bet cap, starting bankroll.
3. Set number of rounds (100, 1K, 10K, 100K).
4. Click "Simulate."
5. View results: bankroll curve, final balance, bust rate (run 100 simulations and show % that busted), empirical RTP, outcome distribution.

Comparison mode: run 2-4 strategies simultaneously, same crash point sequence, and overlay the bankroll curves.

Key educational outcomes:
- Martingale shows frequent small wins but occasional catastrophic busts.
- All strategies converge to the same EV over large sample sizes.
- Higher variance strategies bust more often with finite bankrolls.

## 7. Hourly Cost Calculator (`FlameoutCostCalc.vue`)

Simple calculator:

- Inputs: bet size, rounds per hour (default 100), RTP.
- Output: "At $10/bet, 100 rounds/hour, and 97% RTP, your expected cost of play is $30.00/hour."
- Comparison: "That's equivalent to [X] movie tickets per hour" or similar real-world anchors.

## 8. House Edge Comparison Table

Static reference table contextualizing crash game odds against other casino games (data from Doc 00, Section 3.7). Links to other Metaincognita simulators where applicable.

## 9. Testing Checklist

- [ ] Probability explorer produces correct values for all multipliers at all RTP settings.
- [ ] EV invariance demo shows convergence within ±1% across strategies over 10K rounds.
- [ ] Distribution chart correctly bins crash points and overlays theoretical curve.
- [ ] Streak analysis correctly tracks streaks and displays accurate conditional probabilities.
- [ ] Strategy lab batch simulation completes 100K rounds in <2 seconds.
- [ ] Strategy lab comparison uses identical crash sequences across strategies.
- [ ] Hourly cost calculator arithmetic is correct.

---

# Doc 05: Polish, Testing & Deploy

## 1. Responsive Design

- Breakpoints: 320px (small mobile), 640px (large mobile), 768px (tablet), 1024px (desktop), 1440px (wide desktop).
- Canvas aspect ratio maintained via CSS `aspect-ratio: 2/1` with max-height constraint.
- Controls stack vertically on mobile, horizontal on desktop.
- Analytics panels collapse into tabbed interface on mobile.

## 2. Performance Targets

| Metric | Target |
|---|---|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Canvas rendering (RUNNING) | 60fps sustained |
| Batch sim: 10K rounds | < 500ms |
| Batch sim: 100K rounds | < 2s |
| Bundle size (gzipped) | < 300KB total |

## 3. Accessibility

- WCAG 2.1 AA compliance.
- All interactive elements keyboard-navigable.
- `prefers-reduced-motion`: disable canvas animation, show static multiplier readout.
- `prefers-color-scheme`: auto dark/light mode.
- Canvas content mirrored in `aria-live` region for screen reader users.

## 4. Sound (Optional Enhancement)

If implemented, minimal sound design:

- Rising tone during RUNNING phase (pitch increases with multiplier).
- Cash-out confirmation ding.
- Crash explosion sound.
- Muted by default; opt-in via settings.

## 5. Testing Strategy

### Unit Tests (Vitest)

- Engine: crash point distribution, state machine transitions, bankroll math, strategy bet sequences.
- Analytics: probability calculations, EV computations, streak tracking.

### Component Tests (Vitest + Vue Test Utils)

- All UI components render correctly in each game state.
- Bet validation, cash-out button state changes, history strip population.

### E2E Tests (Playwright)

- Full game round: place bet → watch multiplier rise → cash out → verify payout.
- Auto-bet + auto-cashout runs 5 rounds unattended.
- Strategy lab runs a simulation and displays results.
- Responsive layout at 375px and 1440px.

## 6. Deployment

- **Platform**: Netlify (SPA mode).
- **Domain**: flameout.metaincognita.com.
- **Build command**: `yarn build`.
- **Publish directory**: `.output/public`.
- **Headers**: standard security headers (CSP, X-Frame-Options, etc.) via `netlify.toml`.
- **Redirects**: SPA fallback `/* → /index.html 200`.

## 7. Pre-Launch Checklist

- [ ] All unit, component, and E2E tests pass.
- [ ] Lighthouse scores: Performance ≥90, Accessibility ≥95, Best Practices ≥95, SEO ≥90.
- [ ] OG meta tags and social preview image configured.
- [ ] Favicon and PWA manifest.
- [ ] Analytics/education content reviewed for mathematical accuracy.
- [ ] Responsible gaming disclaimer present on all pages.
- [ ] Cross-browser tested: Chrome, Firefox, Safari, mobile Safari, mobile Chrome.
- [ ] `localStorage` persistence verified across page reloads.
- [ ] Error boundary catches and displays runtime errors gracefully.

---

# Doc 06: Security Considerations

## 1. Scope

Flameout is a client-side-only educational simulator with no backend, no authentication, no user accounts, and no real money. The security surface is minimal but not zero.

## 2. No Real Money Surface

- No payment processing of any kind.
- No cryptocurrency integration.
- No wallet connections.
- "Balance" is simulated and stored in `localStorage`.
- Clear disclaimers throughout the UI that this is a simulator.

## 3. Client-Side State Protection

- `localStorage` data is not sensitive (simulated bankroll, settings, history).
- No attempt to prevent user manipulation of `localStorage` — they're playing against themselves.
- No leaderboards or competitive features that could incentivize state tampering.

## 4. RNG Integrity

- The RNG is client-side `Math.random()` (or seeded PRNG for reproducibility).
- For an educational simulator, this is appropriate. No provably fair infrastructure is needed.
- The educational module *explains* provably fair systems without implementing one.

## 5. Content Security

- CSP headers: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (Tailwind requires unsafe-inline for JIT).
- No external script loading.
- No third-party analytics (or first-party Plausible if used for the Metaincognita suite).
- No ads, no affiliate links, no tracking pixels.

## 6. Input Validation

- Bet amount: clamped to `[minBet, Math.min(maxBet, balance)]`.
- Auto-cashout target: clamped to `[1.01, 10000]`.
- House edge: clamped to `[0.5, 10]`.
- All numeric inputs sanitized: strip non-numeric characters, `parseFloat`, clamp.

## 7. Dependency Hygiene

- Minimal dependencies: Nuxt 4 ecosystem, Nuxt UI v4, Pinia. No additional runtime dependencies.
- `yarn audit` on every build.
- Renovate or Dependabot for automated updates.

---

# Doc 07: LLM Build Prompt

## Purpose

This document is a self-contained prompt for Claude to build one phase of Flameout at a time. Feed this document plus the relevant phase doc (01–05) to Claude for each build phase.

---

### System Context

You are building **Flameout**, a crash game simulator for the Metaincognita casino education suite.

### Technology Stack (Mandatory)

- **Framework**: Nuxt 4+ (latest stable)
- **UI**: Nuxt UI v4+ (latest stable)
- **State**: Pinia
- **Language**: TypeScript strict mode (`"strict": true` in tsconfig)
- **Styling**: Tailwind CSS v4
- **Package Manager**: Yarn (NOT npm, NOT pnpm)
- **Deployment**: Netlify SPA mode
- **Node**: 20+ LTS

### Architecture Rules

1. **Headless core first.** All game logic lives in composables (`composables/useFlameout*.ts`). No game logic in components. Components consume reactive state from the Pinia store.

2. **Pinia store is the single source of truth.** The store (`stores/flameout.ts`) holds all game state: round state, bankroll, history, settings, analytics. Composables read/write through the store.

3. **Canvas rendering is isolated.** The renderer composable (`composables/useFlameoutRenderer.ts`) takes a canvas ref and store state. It draws frames. It does not manage game logic.

4. **No game engine.** No Phaser, no PixiJS, no Three.js. The canvas uses the native Canvas 2D API with `requestAnimationFrame`.

5. **Integer cents internally.** All money amounts are stored as integers (cents) to avoid floating-point arithmetic errors. Display layer converts to dollars with two decimal places.

6. **TypeScript strict.** All types explicitly defined. No `any`. Interfaces for all data structures. Enums for state machine states.

7. **Composable pattern.** Each functional domain has its own composable:
   - `useFlameoutEngine` — RNG, state machine, bankroll, round lifecycle
   - `useFlameoutRenderer` — canvas drawing, animation loop
   - `useFlameoutAnalytics` — session stats, distribution tracking, streak analysis
   - `useFlameoutStrategy` — betting system definitions, batch simulation

8. **File structure:**
```
pages/
  index.vue                    — Main game view
  learn.vue                    — Educational content / provably fair explainer
components/
  flameout/
    Canvas.vue
    Controls.vue
    BetInput.vue
    ActionButton.vue
    AutoCashout.vue
    HistoryStrip.vue
    Stats.vue
    Settings.vue
    ProbabilityExplorer.vue
    EVDemo.vue
    DistributionChart.vue
    StreakAnalysis.vue
    StrategyLab.vue
    CostCalculator.vue
composables/
  useFlameoutEngine.ts
  useFlameoutRenderer.ts
  useFlameoutAnalytics.ts
  useFlameoutStrategy.ts
stores/
  flameout.ts
types/
  flameout.ts                  — All shared type definitions
utils/
  flameout-math.ts             — Pure math functions (crash point gen, probability calc)
  flameout-rng.ts              — Seeded PRNG implementation
```

9. **Environment variables:** None required. This is a fully client-side application.

10. **Testing:** Vitest for unit tests. Test files colocated: `*.test.ts` next to source files.

### Per-Phase Instructions

When building a phase, implement every feature described in the corresponding phase doc. After completing each file, verify it compiles with `yarn typecheck`. After completing the phase, run `yarn test` to verify all tests pass.

### Style Guidelines

- Component names: PascalCase, prefixed with `Flameout` (e.g., `FlameoutCanvas.vue`).
- Composable names: camelCase, prefixed with `useFlameout` (e.g., `useFlameoutEngine`).
- CSS: Tailwind utility classes only. No custom CSS files. No `<style>` blocks in SFCs except for canvas-specific layout.
- Prose content (educational text, tooltips): stored in markdown files or component templates, never hardcoded in logic files.

### Quality Gates

Each phase must pass before moving to the next:
- `yarn typecheck` — zero errors.
- `yarn lint` — zero errors.
- `yarn test` — all tests pass.
- Manual verification of the phase's testing checklist from the phase doc.

---

# Doc 08: Competitive Landscape & Differentiation

## 1. Market Overview

The crash game market is dominated by a single title: **Aviator by Spribe**. Spribe controls approximately 90% of the crash game market. Players wagered an estimated €160 billion on Aviator in 2025 alone, making it one of the largest single-game betting volumes in online casino history. The game is integrated by over 2,000 operators worldwide.

Other notable titles include JetX (SmartSoft Gaming), Spaceman (Pragmatic Play), Crash X (Turbo Games), and platform-native implementations from Stake, BC.Game, and Roobet.

## 2. Competitive Comparison

| Feature | Aviator | JetX | Stake Crash | **Flameout** |
|---|---|---|---|---|
| RTP | 97% | 97% | 99% | Configurable (95–99%) |
| Provably fair | SHA-512 | Yes | SHA-256 | Educational explainer only |
| Multiplayer | Yes (social) | Yes | Yes | Single-player (simulated) |
| Auto-cashout | Yes | Yes | Yes | Yes |
| Auto-bet | Yes | Yes | Yes | Yes |
| Dual bet | Yes | Some | No | No (future enhancement) |
| In-game chat | Yes | Yes | Yes | No |
| Real money | Yes | Yes | Yes | **No — simulator only** |
| Probability explorer | No | No | No | **Yes** |
| EV invariance demo | No | No | No | **Yes** |
| Strategy lab | No | No | No | **Yes** |
| Distribution analysis | No | No | No | **Yes** |
| Streak analysis | No | No | No | **Yes** |
| Cost calculator | No | No | No | **Yes** |
| Configurable house edge | No | No | No | **Yes** |

## 3. Flameout's Positioning

Flameout is not competing with Aviator. It occupies a different category entirely: **educational simulator**. No commercial crash game provides tools to understand its own mathematics, because doing so would undermine the business model. Flameout fills this gap.

Target audiences:
- **Curious players** who want to understand the game before (or instead of) playing for real money.
- **Students** of probability, statistics, or game theory seeking interactive demonstrations.
- **Responsible gambling advocates** looking for tools that demystify casino mathematics.
- **Developers** interested in crash game mechanics and implementation.

## 4. Differentiation Summary

The core differentiator is simple: every commercial crash game is designed to extract money. Flameout is designed to explain why that extraction is mathematically inevitable.

---

# Doc 09: Website & Landing Page

## 1. Domain

`flameout.metaincognita.com`

## 2. Integration

Listed on the main `metaincognita.com` suite page alongside Roulette, Blackjack, Hold'em, Video Poker, Craps, and PachinkoParlor. Suite-wide navigation header links between all simulators.

## 3. Landing Page Content

The main `index.vue` page serves as both landing page and game. Above the game canvas:

- **Title**: "Flameout"
- **Subtitle**: "A crash game simulator. No real money. Just math."
- **One-line description**: "Watch the multiplier climb. Cash out before the crash. Then see why the house always wins."

Below the game and analytics:

- Link to `/learn` for the educational deep-dive.
- Link to the Metaincognita suite.
- Responsible gaming notice.

## 4. Learn Page (`/learn`)

Long-form educational content covering:

1. What is a crash game?
2. How the mathematics work (crash point distribution, EV invariance).
3. Why no strategy beats the house edge.
4. How provably fair systems work.
5. The history of crash games (condensed from Doc 13).
6. Comparison to other casino games.

Written in plain, accessible language. Illustrated with interactive examples that link back to the simulator's tools.

## 5. SEO / Meta

```html
<title>Flameout — Crash Game Simulator | Metaincognita</title>
<meta name="description" content="A free crash game simulator for learning casino mathematics. Explore probability, expected value, and house edge with interactive tools. No real money.">
```

OG image: stylized flame sprite against a dark background with a rising multiplier curve.

---

# Doc 10: Revision & Gap Analysis

## 1. Purpose

This document is populated after the build is complete. It captures what was built vs. what was specified, what changed during implementation and why, and what gaps remain for future work.

## 2. Template

### 2.1 Implemented as Specified
*(List features built exactly as documented)*

### 2.2 Implemented with Changes
*(List features that were built but deviated from spec, with rationale)*

### 2.3 Deferred
*(List features not built, with rationale and priority for future work)*

### 2.4 Added During Build
*(List features added that were not in the original spec)*

### 2.5 Known Issues
*(List bugs or limitations discovered during build)*

## 3. Candidate Future Enhancements

- **Simulated multiplayer feed**: Synthetic bot players appearing in a side panel to mimic the social dynamic of real crash games.
- **Dual bet**: Allow placing two bets per round with different cashout targets (matches Aviator's dual bet feature).
- **Sound design**: Minimal audio feedback (rising tone, cashout ding, crash sound).
- **Provably fair demo**: Interactive module where user can input a seed and see the hash chain generate crash points, then verify them.
- **Export session data**: Download round history as CSV for external analysis.
- **Embeddable widget**: Standalone HTML/JS bundle for embedding the simulator in other educational sites.

---

# Doc 11: Architecture Decision Records

## ADR-001: No Game Engine

**Decision**: Use native Canvas 2D API with `requestAnimationFrame`. No Phaser, PixiJS, or other game engine.

**Context**: Crash games are visually simple — a rising curve, a sprite at the tip, and particle effects on crash. The complex parts of Flameout are the UI controls and analytics, which are standard DOM/component work.

**Rationale**: Phaser adds ~1MB to the bundle, introduces a parallel state/event system that must be bridged to Vue reactivity, and provides capabilities (physics engine, tilemap system, scene management) that Flameout does not use. The rendering requirements are met by 100-200 lines of canvas code.

**Consequences**: Particle effects are hand-rolled (minimal effort). Sprite animation is manual (drawImage with rotation). No access to Phaser's tweening library (replaced by simple easing functions).

## ADR-002: Integer Cents for Money

**Decision**: All monetary values stored as integers (cents). Display layer divides by 100.

**Context**: JavaScript floating-point arithmetic produces rounding errors (e.g., `0.1 + 0.2 !== 0.3`). In a financial simulator running thousands of rounds, these errors accumulate.

**Rationale**: Integer arithmetic is exact. `1000` cents = `$10.00`. No rounding errors across any number of operations.

**Consequences**: All bet amounts, payouts, and bankroll values are integers internally. The UI formats them as dollars. The RNG output (crash multiplier) remains a float, but payout calculation uses integer math: `payout = Math.floor(betCents * multiplier)`.

## ADR-003: Seeded PRNG for Strategy Comparison

**Decision**: Implement a lightweight seeded PRNG alongside `Math.random()`.

**Context**: The EV Invariance Demonstrator and Strategy Lab must run multiple strategies against the *same* sequence of crash points to produce a fair comparison.

**Rationale**: `Math.random()` cannot be seeded. A simple 32-bit PRNG (e.g., mulberry32) provides deterministic sequences from a seed, enabling reproducible simulations.

**Consequences**: Two RNG code paths: `Math.random()` for live gameplay, seeded PRNG for batch simulation. The seeded PRNG is not cryptographically secure, which is irrelevant for a simulator.

## ADR-004: Single-Player Only

**Decision**: No multiplayer, no WebSocket, no backend.

**Context**: Real crash games are multiplayer with live social feeds. Building this would require a backend server, WebSocket infrastructure, and user authentication.

**Rationale**: Flameout is an educational tool, not a social platform. The social dynamics of crash games (watching others cash out, social pressure) are interesting but not essential to the mathematical education mission. Adding multiplayer would require a backend, increasing complexity, cost, and deployment requirements by an order of magnitude.

**Consequences**: No live chat, no player leaderboard, no shared round experience. A simulated bot feed could be added as a future enhancement to approximate the social dynamic.

## ADR-005: localStorage for Persistence

**Decision**: Persist session state (bankroll, settings, history) to `localStorage`.

**Context**: Players should be able to close the tab and resume their session later without losing progress.

**Rationale**: `localStorage` is synchronous, simple, universally supported, and sufficient for storing JSON-serialized game state. No backend or database needed.

**Consequences**: State is per-browser, per-device. Clearing browser data resets the session. No cross-device sync. Maximum storage ~5MB (more than sufficient for round history and settings).

---

# Doc 12: Use Cases & Player Journeys

## UC-01: First-Time Player

**Persona**: College student who saw a crash game on TikTok and wants to understand it.

**Journey**:
1. Lands on flameout.metaincognita.com. Sees the game canvas with a brief "How to Play" overlay.
2. Dismisses the overlay. Default $1,000 balance loaded.
3. Places a $10 bet. Watches the multiplier rise. Panics and clicks cash-out at 1.47×. Wins $14.70.
4. Plays 10 more rounds, winning some, losing others. Notices the history strip showing crash points.
5. Explores the Probability Explorer. Enters 2.00× and sees the 48.5% probability. Has an "aha" moment.
6. Visits `/learn` to read about how the math works.

## UC-02: Strategy Experimenter

**Persona**: Recreational gambler who believes the Martingale system "works."

**Journey**:
1. Opens the Strategy Lab.
2. Configures Martingale: $10 base bet, 2.00× cashout, $1,000 bankroll.
3. Runs 1,000 rounds. Sees the bankroll spike early, then crash to zero on round 347.
4. Runs 100 simulations. Sees that 73% of them bust before 1,000 rounds.
5. Compares Martingale to Flat betting over the same sequence. Sees identical long-run loss rates.
6. Reluctantly accepts that bet sizing does not change expected value.

## UC-03: Gambler's Fallacy Explorer

**Persona**: Player who "knows" that after five low crashes, a big one is coming.

**Journey**:
1. Plays 50 rounds with auto-bet on.
2. Opens Streak Analysis. Sees a streak of 8 consecutive crashes below 2.00×.
3. Notices the conditional probability display: "After 8 crashes below 2.00×, the probability of the next round reaching 2.00× is: 48.5%. Unchanged."
4. Runs the EV Invariance Demo with 10,000 rounds. Watches the line converge regardless of where they "should have" bet differently.
5. Understands — viscerally, not just intellectually — that each round is independent.

## UC-04: Math / Statistics Student

**Persona**: University student studying probability distributions.

**Journey**:
1. Sets house edge to 1% and runs 100,000 rounds in instant mode via Strategy Lab.
2. Opens Distribution Chart. Observes the empirical histogram converging perfectly to the theoretical `P(m) = r/m` curve.
3. Changes house edge to 5%. Runs another 100K. Observes the shift in the distribution — more weight on low crash points.
4. Uses the Probability Explorer to derive the EV cancellation proof manually, checking their work against the tool.
5. Exports round history (future enhancement) for use in a statistics assignment.

## UC-05: Responsible Gambling Educator

**Persona**: Counselor or educator running a workshop on gambling awareness.

**Journey**:
1. Projects Flameout on a classroom screen.
2. Has students take turns placing bets and cashing out.
3. After 20 rounds, opens the Session Stats. Shows the class the empirical RTP.
4. Opens the Hourly Cost Calculator. Plugs in realistic numbers ($10/bet, 100 rounds/hour, 97% RTP). Shows "$30/hour cost."
5. Opens the EV Invariance Demo. Runs conservative vs. aggressive strategies. Shows that both lose at the same rate.
6. Leads discussion on why gambling feels like it "should" work despite the math.

---

# Doc 13: Historical Appendix — The Rise of the Crash Game

## 1. Origins: A Canadian Developer and a Bitcoin Forum (2014)

The crash game was born not on a casino floor or in a game studio, but on the Bitcointalk forum — the primordial message board of the cryptocurrency community.

In July 2014, a Canadian developer named Eric Springer, posting under the handle "espringe," introduced a game he called **MoneyPot**. The concept was deceptively simple: a multiplier starts at 1× and rises until it "crashes." Players bet on when to cash out. If they bail before the crash, they multiply their Bitcoin wager. If they don't, they lose it.

Springer drew his inspiration from the one thing every crypto enthusiast in 2014 understood viscerally: **volatility**. Cryptocurrencies rocket in value until, one day, they go to zero. The people who exit in time get rich. The people who hold too long get wiped out. Springer took that dynamic — a dynamic his audience was already emotionally addicted to — and turned it into a game.

MoneyPot was visually primitive: a bare x/y-axis graph with a single line that went up until it didn't. There was no plane, no rocket, no astronaut. Just a line on a chart — which, for an audience of Bitcoin traders, was exactly the right aesthetic. As one industry observer later noted, it looked more like a STEM assignment than a game.

But it worked. Within two months of its Bitcointalk announcement, MoneyPot had logged over **250,000 plays** and processed more than **180 BTC** in wagers from **1,750 users**. In September 2014, with Bitcoin hovering around $450, that represented roughly $81,000 in total wagering volume. Not world-shaking numbers, but for a game built and maintained by a single developer out of his personal savings, it was a signal.

Two features of MoneyPot would prove prescient. First, it was a **social game**: all players bet on the same event simultaneously, creating a shared experience of watching the line rise together, with the chat feed showing who cashed out and who was still riding. Second, it introduced a **provably fair system** based on cryptographic hash chains, allowing players to verify that outcomes were predetermined and unmanipulated. Both features would become standard in the genre.

## 2. The Handoffs: From MoneyPot to Bustabit (2015–2018)

Running a real-money gambling platform as a solo developer turned out to be, unsurprisingly, exhausting. In 2015, Springer sold MoneyPot to **Ryan Havar**, a member of the Bitcointalk community. Havar rebranded the game as **Bustabit** and moved it to a new site.

Under Havar, Bustabit introduced the **"last-longer bonus"** — a prize pool funded by taking a 1% cut of every player's wager and awarding it to the last player to successfully cash out before each crash. This was a clever mechanical addition that injected a competitive skill element into an otherwise pure-chance game: players now had an incentive to wait longer than everyone else, adding a layer of game theory (and hubris) to each round.

The community's response was mixed. Some players loved the competitive twist. Others saw it as an unnecessary additional edge on top of the existing 1% house edge. The debate foreshadowed a tension that would persist in the crash game world: how much "game" should be layered on top of the core multiplier mechanic?

Havar eventually sold Bustabit again, this time to **Daniel Evans**, a crypto developer who still operates the site today. Evans removed the last-longer bonus, added non-cryptocurrency payment options, and — in a move unusual for a gambling operator — allowed **third-party investors to bankroll the game** in exchange for a share of its profits. This turned Bustabit into something like a decentralized casino: investors provided the house bankroll, and the house edge was their return on investment.

Bustabit also supported **user-created gambling scripts** — automated betting strategies that players could write in JavaScript and deploy against the game. This attracted a technically sophisticated user base and created a community of amateur quants optimizing betting algorithms against a 1% house edge, all while generating content and discussion that kept the platform alive.

## 3. The CS:GO Skin Gambling Connection (2015–2017)

While Bustabit was evolving in the crypto niche, crash games were spreading through an unexpected vector: **Counter-Strike: Global Offensive skin gambling sites**.

The CS:GO skin economy — where cosmetic weapon finishes could be traded for real money — had given rise to an entire ecosystem of gambling platforms where players wagered virtual skins on games of chance. Crash was a natural fit for these platforms. It was fast, simple, visually straightforward, and could be implemented quickly by the young developers building CS:GO gambling sites.

By 2016-2017, crash had become a staple of the CS:GO gambling world, alongside coinflip and jackpot games. Platforms like CSGOCrash and others brought the crash format to an audience of **millions of gamers** — many of them teenagers — who might never have encountered cryptocurrency casinos.

This was also the period when the term "crash gambling" solidified as the genre's name. The CS:GO gambling boom would eventually attract regulatory scrutiny and largely collapse (Valve shut down the Steam API access that enabled skin trading), but its contribution to crash game history was significant: it proved the format had mass appeal far beyond the Bitcoin enthusiast community where it originated.

## 4. Spribe and the Birth of Aviator (2018–2019)

The leap from crypto niche to mainstream casino came courtesy of **Spribe**, a game studio headquartered in Kyiv, Ukraine. Founded in 2018, Spribe set out to modernize casino content for a generation of players raised on mobile apps and social media.

Spribe CEO **David Natroshvili** has always been candid that he did not invent the crash game. What Spribe did was take the raw mechanics of MoneyPot/Bustabit and apply professional game design, polished UX, and aggressive marketing. As Natroshvili has said: Facebook wasn't the first social network; Apple wasn't first to make mobile phones; Amazon didn't invent e-commerce. They all just did it better.

**Aviator** launched in late 2018 and quickly became a phenomenon. The game replaced the bare chart line with a charming **little red plane** that climbed across the screen, trailing a path behind it. When the crash came, the plane flew away. The mechanic was identical to MoneyPot's, but the presentation was warm, intuitive, and — crucially — performant on low-end mobile devices with limited bandwidth.

This last point mattered enormously. Aviator's rise was fueled by markets where smartphone penetration was high but data speeds were low: **Africa, Brazil, India, and Southeast Asia**. A crash game requires almost no data to operate — it's a single number rising on a screen. No 3D graphics, no heavy assets, no streaming video. In regions where players accessed casinos on $100 Android phones over 3G connections, Aviator loaded fast and ran smoothly while slot games stuttered and live dealer games were unplayable.

## 5. The Explosion: $160 Billion and 77 Million Monthly Players (2020–2025)

The COVID-19 pandemic in 2020 accelerated the growth of online gambling globally, and crash games — particularly Aviator — rode the wave. By the end of 2020, nearly every cryptocurrency casino was offering a proprietary crash title.

Spribe's trajectory from 2020 onward is staggering by any measure:

- **90% market share** of the crash game vertical.
- Integration with over **2,000 operators** worldwide.
- **77 million monthly active players** as of 2025.
- An estimated **€160 billion** in total wagers processed in 2025 — one of the largest single-game betting volumes in online casino history.
- Licensing from the UK Gambling Commission, Malta Gaming Authority, and multiple other jurisdictions.
- Partnerships with UFC, WWE, and AC Milan, plus ambassadors including UFC fighters Tom Aspinall and Alex Pereira.

In Africa, Aviator saw a 53.93% year-on-year rise in monthly active players in 2024, with the continent accounting for nearly 20% of new global player inflows. In India and the Asia-Pacific region, monthly active users grew by an astounding 629.67% in 2024.

Aviator became so popular in Brazil that players developed their own nickname for it: **"Jogo do aviãozinho"** (the little airplane game). It became a grassroots cultural phenomenon, with players searching for the game by name before they even chose which casino to play on — a reversal of the normal acquisition funnel that fundamentally changed the economics of operator-player relationships.

## 6. Why It Caught Fire: The Psychology of the Crash

The crash game's popularity is not an accident. Several psychological factors converge to make the format uniquely compelling:

**The illusion of control.** Unlike a slot machine, where you press a button and fate decides, a crash game makes you feel like *you* decided the outcome. You chose when to cash out. You could have waited longer. You could have bailed sooner. This sense of agency — even though the EV math is identical regardless of your choice — is profoundly engaging.

**Real-time shared experience.** Watching the multiplier climb alongside hundreds of other players, seeing who bails at 1.5× and who's still riding at 8×, creates a collective tension that slots and table games rarely match. The live chat amplifies this: players celebrate big wins, mourn crashes, and egg each other on in real time.

**Speed.** Rounds last 5-60 seconds. The dopamine cycle — bet, anticipation, resolution — completes in under a minute. This is faster than almost any other casino game. More rounds per hour means more emotional peaks per hour.

**The crypto-native aesthetic.** The rising multiplier line looks exactly like a cryptocurrency price chart. For a generation raised on watching Bitcoin's value spike and crash, the crash game format feels familiar, almost nostalgic. It's a game that mirrors the emotional experience of speculative trading.

**Low barriers.** No rules to learn, no strategy to study, no cards to count, no table etiquette to navigate. Place your bet. Watch the number go up. Click the button. Anyone can play within five seconds of seeing the game.

## 7. The Provably Fair Revolution

One of crash gaming's most significant contributions to the broader gambling industry is the popularization of **provably fair** verification.

Traditional online casino games rely on third-party auditors to certify that their RNG is fair. Players have to trust the casino and the auditor. Provably fair systems, pioneered by MoneyPot and refined by Bustabit, use cryptographic hash chains to allow *every player* to independently verify that every round's outcome was predetermined and unmanipulated.

The mechanism is elegant: the casino pre-generates millions of game outcomes as a hash chain (each hash is the SHA-256 of the next game's hash, played in reverse order). The chain is "salted" with a public seed the casino cannot control (typically a future blockchain block hash). After each round, the casino reveals the unhashed seed, and any player can verify that hashing it produces the previously published hash. The entire chain is deterministic and tamper-evident.

This innovation emerged from the crypto community's deep-rooted skepticism of centralized authority. It has since spread beyond crash games to other casino formats and is now a standard expectation among crypto casino players.

## 8. The Legal Battles

Success breeds imitation and litigation. By 2024, the crash game space had become contentious enough to produce real legal drama.

A Georgian company called **Aviator LLC** — not affiliated with Spribe — claimed ownership of the Aviator brand name and sued Flutter Entertainment (one of the world's largest gambling operators) for offering Spribe's version of the game. In August 2024, Aviator LLC claimed it had been awarded **€330 million in damages** from Flutter — coincidentally the same amount Flutter reportedly paid to acquire Adjarabet, the Georgian operator founded by Aviator LLC's owner.

Spribe contested the claims, and the case went to Georgian courts. The dispute highlights the enormous financial stakes now attached to the crash game format and the Aviator brand specifically.

## 9. Where It Stands Today

As of early 2026, crash games represent approximately 1.1% of European iCasino gross gaming revenue — a figure that understates their cultural impact and growth trajectory. The format continues to expand into new markets and demographics.

New entrants continue to iterate on the formula. **Aviatrix** offers NFT-based customizable aircraft. Evolution has adapted crash mechanics into its live game show format with **Cash or Crash**. Every major game provider now offers at least one crash title.

But the fundamental game — the game Eric Springer built on the Bitcointalk forum in 2014 — remains unchanged. A number goes up. At some point it stops. Your only decision is when to get out.

It's the simplest game in any casino. And ten years after its invention, it's one of the most popular gambling formats on Earth.

---

*This document is part of the Flameout design suite for the Metaincognita casino simulator project. Flameout is an educational simulator. No real money is wagered.*

---

**End of Flameout Design Document Suite (Docs 01–13)**
