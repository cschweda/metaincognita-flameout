# Changelog

All notable changes to Flameout will be documented in this file.

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
