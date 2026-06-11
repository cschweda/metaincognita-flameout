# Changelog

All notable changes to Flameout will be documented in this file.

## [0.4.0] - 2026-06-11

### Added

- **Strategy Lab UI** on the Analysis page: simulate Flat, Martingale, D'Alembert, Fibonacci, and Paroli over 1K–100K rounds, with a compare-all mode that runs every system against the identical seeded crash sequence and overlays the bankroll curves (SVG chart, results table, expected-loss summary)
- **Learn page** (`/learn`): the full crash-game mathematics — inverse distribution with probability table, crash point generation and the instant-crash house edge mechanism, the EV-invariance proof, variance profiles, gambler's fallacy, betting systems, house edge comparison, provably fair cryptography explainer, and a history timeline — linked from the bottom nav and setup screen
- **Side-game accounting**: variant results (gauntlet items, jackpot spins) are tracked in a new `sideGameNet` field, shown in the stats sidebar and Analysis page, and excluded from `totalReturned` so empirical RTP always reflects the crash game alone
- **Session resume after navigation**: leaving the game page mid-round no longer freezes the round — on return, the engine resolves whatever happened in the meantime (crash or auto-cashout) from wall-clock timestamps, and the canvas backfills the curve
- **Reduced-motion support**: `prefers-reduced-motion` stills the starfield/wisp drift, disables particles, screen shake, and pulsing buttons
- **Screen reader announcements**: round results (cashed out / crashed / busted) are announced via an `aria-live` region; the canvas has an accessible label
- Versioned localStorage persistence (v2) with sanitization and automatic migration of v1 sessions
- Unit tests for the store (round ids, side-game accounting, persistence migration) and the variant economy (EV neutrality, reel distribution) — 63 tests total
- CI now runs the test suite and a production build in addition to lint and typecheck
- `pnpm dev:fresh` (`start-dev-server.sh`): kills anything on the dev port plus any stray dev server from this project, then starts a fresh one (`PORT=3001` to override the port)

### Changed

- **Gauntlet item economy rebalanced to exactly zero EV** (weights × midpoint values sum to 0, verified by unit test) — the side game adds variance and skill, not free money
- **Jackpot spins are now staked**: collecting a trigger deducts its stake; reels pay 10×/5×/2× the stake for triple-7s/triples/doubles (EV = stake, variance only). Triggers you can't afford are skipped
- **Jackpot spins freeze round time** instead of letting the multiplier climb past the crash point; manual cashout is locked while reels roll (previously a spin could carry the round beyond its predetermined crash point — strictly +EV)
- Crash is now checked before auto-cashout within a frame: reaching the crash point and the target simultaneously is a loss (also removes a double-settle race)
- Engine timing is derived from `startedAt` timestamps instead of an animation-loop accumulator; engine state is module-scoped so all components share one loop and `cleanup()` cancels every pending timer
- Canvas performance: canvas buffer is sized once via `ResizeObserver` instead of every frame (per-frame `getBoundingClientRect` + buffer reallocation removed), hot-loop state uses plain arrays instead of reactive refs, long-round curves are decimated
- Variant item spawn offsets and steering range now scale with canvas height — Gauntlet/Jackpot items no longer spawn off-screen on small displays
- Arrow-key handling is scoped to variant modes during a running round (no more hijacked page scrolling in Classic)
- Pure rendering extracted to `utils/canvas-draw.ts` and variant game logic to `utils/flameout-variants.ts` (Canvas.vue: 1,524 → ~700 lines)
- `formatCents` renders negative amounts as `-$3.00` instead of `$-3.00`
- Content-Security-Policy: removed `unsafe-eval` from `script-src`

### Fixed

- **Risk-free cashout exploit**: navigating away mid-round froze the multiplier while keeping cashout armed, guaranteeing a win on return
- **Background auto-bet**: orphaned settle timers could keep playing rounds (and burning bankroll) after leaving the game page with auto-bet enabled; "Leave & Save" now also cancels in-flight round timers
- Spacebar no longer places bets / cashes out while typing in the bet or auto-cashout inputs
- Round ids no longer collide after the 1000-round history trim (monotonic counter, persisted) — fixes duplicate row keys in the History table
- Crash explosion burst now uses the same vertical scale as the curve (it could render at the wrong height when an auto-cashout target was set)
- Corrupt or partially missing localStorage payloads no longer poison the session (NaN balances); fields are validated and defaulted on load
- Canvas resize listener and reduced-motion media listener are removed on unmount (previously leaked)

## [0.3.0] - 2026-04-06

### Added

- **Game variant system**: selectable game modes on setup screen (Classic, Gauntlet, Jackpot)
- **Gauntlet mode**: steer the jet vertically (arrow keys / W/S) to collect bonuses and dodge obstacles as the multiplier climbs
  - 5 item types: Coin (+$1–5), Star (+$5–15), Diamond (+$10–25), Mine (-$3–10), Asteroid (-$5–15)
  - Weighted spawn rates with increasing frequency and value over time
  - Collision detection, screen shake on obstacle hits, floating +/- text popups
  - Running bonus total displayed on canvas
  - Jet stays level (Scramble/Zaxxon style) — only translates vertically, no tilting
- **Jackpot mode**: collect golden slot triggers to spin a 3-reel slot machine mini-game
  - 5 slot symbols: 7, Cherry, Diamond, Bar, Star
  - Triple 7s = 25× base value, triple match = 10×, double match = 3×, no match = nothing
  - Crash mechanics suspended during active spin — multiplier keeps climbing but won't crash until reels finish
  - Animated reel-stop sequence (left → middle → right) with result glow
  - Base values increase as the game progresses
- **Animated canvas background**: dynamic gradient sky, 140-star parallax starfield, nebula wisps, horizon glow, vignette
  - Sky color shifts from deep blue to purple/warm as multiplier climbs
  - Stars drift during flight, twinkle, and gain glow halos at high multipliers
  - Crash = red tint, cashout = green tint
  - Screen shake on crash
  - Curve glow effect (soft wider line behind main curve)
- **SPA loading screen**: dark branded splash with jet icon, gold title, "Metaincognita Casino Simulator Suite" subtitle, feature tags, animated progress bar, twinkling starfield (matches pachinko project aesthetic)
- **Demo mode**: `?demo=1&mode=classic|gauntlet|jackpot` URL parameter auto-starts a game session without localStorage, skipping How to Play modal

### Changed

- Variant modes position jet at 28% canvas width (left side) for item reaction time
- Canvas render loop now runs continuously (background animates even during WAITING phase)
- Grid lines glow intensity scales with multiplier

### Fixed

- Jet no longer tilts when steering vertically in variant modes (fixed horizontal angle)

## [0.2.0] - 2026-04-05

### Added

- Jet sprite with afterburner flame trail replacing the plain dot at the curve tip
- Particle system: trail particles during flight, 24-particle radial burst on crash
- "How to Play" modal shown on first visit explaining the three-step game flow
- "New Game" button in game header with confirmation modal to reset session
- Hover tooltips on history strip badges showing round details, payout math, and dollar explanations
- Win/loss indicators (checkmark/X) on history strip badges
- Spacebar keyboard hint in controls bar
- GitHub link in bottom status bar

### Changed

- Cash-out button is now a large, full-width, pulsing amber button during RUNNING phase (previously a small generic button)
- Place Bet button is now a large green gradient button
- Round stops immediately on cashout instead of continuing to the crash point
- Multiplier display shows profit/loss amount after round ends (green for wins, red for losses)
- Phase badge shows green "Cashed out at X.XX×" on successful cashout instead of red crash message
- Auto-bet now places bet and starts round immediately instead of waiting for betting window timer
- History strip label changed from "History" to "Crash points" for clarity
- Start Game button on setup screen enlarged with gradient styling

### Fixed

- Phantom rounds no longer fill history strip when player isn't betting (removed 5-second auto-loop)
- Rounds with no bet placed are no longer recorded to history
- Modal accessibility warnings resolved: all UModal instances now use title/description props for screen reader support
- History strip tooltips now render correctly (switched from clipped custom div to Nuxt UI UTooltip portal)

## [0.1.0] - 2026-04-05

### Added

- Project scaffolding: Nuxt 4 + Nuxt UI v4 + Pinia + Tailwind CSS v4
- Headless core engine (`useFlameoutEngine`) with full round state machine (WAITING → RUNNING → CRASHED → SETTLING → BUSTED)
- Crash point RNG using inverse distribution with configurable house edge (0.5%–10%)
- Seeded PRNG (mulberry32) for reproducible strategy simulations
- Math utilities: crash point generation, probability calculations, EV invariance, payout math
- Pinia store with bankroll management, round history, and localStorage persistence
- Strategy engine with five betting systems: Flat, Martingale, D'Alembert, Fibonacci, Paroli
- Batch simulation runner for Strategy Lab (supports 100K+ rounds)
- Analytics composable: session stats, distribution tracking, streak analysis, probability explorer
- Setup screen with house edge presets (1%, 3%, 5%), bankroll selection, and speed control
- Game screen with canvas multiplier curve, real-time controls, and auto-cashout
- Stats sidebar with Session and Probability tabs
- Round history strip with color-coded crash point badges
- History page with full round-by-round table
- Analysis page with session stats, financial breakdown, streak tracking, and crash point distribution
- Layout shell matching Metaincognita suite pattern: top bar, bottom bar (History/Analysis), dark mode
- Keyboard controls: Space to place bet / cash out
- Netlify deployment config with SPA redirects and security headers
- Unit tests (41 passing): RNG distribution verification, crash point math, probability calculations, strategy bet progressions, batch simulation
- Session resume: reload page without losing progress
