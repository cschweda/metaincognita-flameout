# Changelog

All notable changes to Flameout will be documented in this file.

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
