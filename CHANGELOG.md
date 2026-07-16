# Changelog

All notable changes to Flameout will be documented in this file.

## [Unreleased]

### Added

- **Log-scale toggle and y-axis anchors on the Strategy Lab chart.** On a linear axis one Martingale spike flattens every other curve into the floor; `log y` shows the grind underneath. The chart now also labels its top value and the starting-bankroll line, so the curves have a readable scale
- **The hub exit** (`AppHubLink`): a gold `METAINCOGNITA` wordmark pinned to the far left of the top bar, on every route, linking out to `https://metaincognita.com` — the floor the whole suite hangs off. Flameout previously had no way home: once you were inside the simulator, the only way back to the other games was the browser's back button. It is a real `<a href>` (it leaves the SPA), opens in the same tab, is never gated or hidden, and — unlike the **Back** button beside it, which still confirms because it really does end a live round — it never confirms. It destroys nothing, and a player must always be able to get out. Suite chrome, so it stays gold in every app (guidelines §5)
- **Social preview card**: `public/og.png` (source: `docs/og-card.html`, rendered at 1072×561) plus `og:`/`twitter:` meta — shared links now unfurl with a branded card instead of nothing
- Per-page titles and descriptions for the History and Analysis pages

### Changed

- **Auto-cashout ties now win — in the live engine AND the Strategy Lab.** The engine required `target < crashPoint` (tie lost) while the Lab used `crashPoint >= target` (tie won). Exact ties aren't rare with two-decimal crash points (~0.24% of rounds at a 2× target), so live auto-cashout play converged ~0.5pp *below* the advertised RTP — 96.58% measured vs the Lab's 97.07% at a 3% edge over 5M simulated rounds — and identical strategies produced different numbers live vs simulated. Tie-wins is the convention under which the published table and the EV proof are exact: P(win at m) = P(crash ≥ m) = rtp/m
- **"Instant crashes" now measures the house-edge mechanism, not the displayed 1.00×.** Each round carries an `instant` flag set only by the forced-crash branch. The displayed 1.00× rate is inherently higher (~3.96% at a 3% edge, = 1 − rtp/1.01) because the two-decimal floor rounds organic crashes in [1.00, 1.01) down to 1.00× — so the old stat sat a full point above the "~3%" the copy promised, forever. The Forced Instant stat now converges to the edge; the distribution chart's 1.00× marker uses the floored-distribution probability (1 − rtp/1.01) so its observed bar and theory marker actually converge (the old marker used the bare edge and the bar overshot it by ~30% no matter how many rounds you played — the opposite of the law-of-large-numbers lesson the chart teaches). Legacy records without the flag fall back to the displayed value
- **Fibonacci follows the classic system**: advance one position per loss, retreat two per win — previously any win reset to base, which is a different (and gentler) system than the one the label promised
- **History, Analysis, and the setup screen settle interrupted rounds on mount** (via the new `resolveInterrupted()`, which never starts a follow-up round) — a round that crashed while the app was closed now shows up in those numbers instead of waiting for the game page to be visited
- The canvas steers per-millisecond instead of per-frame (a 120Hz display steered twice as fast as a 60Hz one), re-reads `devicePixelRatio` on every resize (dragging to a different-density monitor kept the old ratio), and under reduced motion draws idle scenes once instead of repainting an identical frame at 60fps
- The sans font stack is now explicitly the system stack. `--font-sans` named `'Public Sans'`, but no webfont ships (local-only build, CSP `connect-src 'self'`), so every browser silently fell back to its default — now the fallback is the design
- CI tests on Node 20, matching `.nvmrc` and the Netlify build image — CI was validating a different major (22) than the one that builds production
- The Analysis page explains why the sample average crash point never settles (the distribution's true mean is infinite — the median is the stable statistic)
- The top bar's "Session active" label is `sr-only` below 640px so the hub exit always fits at 390px. The pulsing dot still carries it visually, and the text stays in the accessibility tree
- **Full static generation (`ssr: true`)**: every route is prerendered to real HTML at build time. Previously the deploy shipped an empty SPA shell — no `<title>`, no meta description, no content — so the entire Learn page was invisible without JavaScript. Now titles, meta, and all Learn content are in the HTML. The game page stays client-only via a route rule (`/game`: `ssr: false`), and the site remains a zero-server static deploy on Netlify
- Bottom-nav items are real links (`NuxtLink`) instead of programmatic buttons — crawlable by the prerenderer and search engines, middle-clickable, and they still park the live session before navigating
- Unknown URLs return a real 404 (`/404.html`) instead of soft-404ing to the home page with a 200

### Fixed

- **Betless "ghost rounds" can no longer start.** `placeBet` silently rejected invalid bets but the engine started the run anyway: Space with a cleared bet input launched a spectator round the player couldn't join or cash out, and auto-bet with an invalid pending bet looped empty rounds forever. `placeBet` now reports success and nothing starts without it; it also rejects non-finite amounts explicitly (NaN passed every guard comparison and would have poisoned the balance)
- **Editing auto-cashout mid-flight can't fire on a partially typed value.** The watcher applied every keystroke and the engine reads the target every frame — typing "2" on the way to "25" with the multiplier at 3.1× cashed out instantly at 2.00×, below the on-screen price. The field now commits on blur/Enter and locks while a bet is at risk
- **Side-game money survives a reload.** Gauntlet collections and jackpot stakes/payouts only reached localStorage at the next cashout/settle, so a reload mid-round rolled them back — and the jackpot time-freeze (`shiftRoundStart`) was never persisted, so a reload after a spin resolved the round on a timeline where the freeze never happened. `applySideGameDelta` persists immediately and spin-end persists the shifted clock (`endJackpotSpin`)
- **Arrow keys and W/S no longer steer — or `preventDefault` — while typing in a field** during Gauntlet/Jackpot rounds. The canvas key handler now uses the same editable-target guard as the Space handler (`isEditableTarget`), so arrows inside the auto-cashout input step the number again instead of flying the jet
- **Persisted settings are sanitized on load**, with the same clamps `initializeGame` applies — the bankroll and in-flight round already got this treatment, but a hand-edited payload could still smuggle in a negative house edge, an absurd speed factor, or an unknown game mode
- **Start Game on the setup screen now confirms before destroying a resumable session** — it sat right next to Resume with no warning, while the in-game New Game button already asked
- The probability explorer clamps its input — clearing the field showed "P(reaching) = 100.00%, ~1 in 1.0"
- How to Play guards its localStorage access — strict privacy modes could throw on mount
- The stats-sidebar toggle and the seed-randomize button have `aria-label`s (they were icon-only)
- **The modal close button had no × on the deployed site.** `lucide:x` is Nuxt UI's default `ui.icons.close`, and every `UModal` renders it — but it is named inside `node_modules`, never in our templates, and @nuxt/icon's scanner is configured to skip exactly that. So it missed the client bundle 0.4.1 built, @nuxt/icon fell back to fetching it from `api.iconify.design`, and the CSP's `connect-src 'self'` blocked the request. The close button shipped as an empty gap on all three modals — **How to Play**, **Leave Game?**, and **Start New Game?** — with nothing but a `[Icon] failed to load icon 'lucide:x'` console warning to show for it. Same class of bug as 0.4.1, and the half it missed: 0.4.1 bundled every icon *we* name; this is the one Nuxt UI names *for* us
- Also pins `lucide:loader-circle` (`ui.icons.loading` — the `UButton`/`UInput` spinner). It was already in the bundle, but only by luck: a `UIcon` in the bet controls happens to name the same icon. Bundle: 19 → 20 icons, 5.90 → 6.08KB
- `nuxt.config.test.ts` now re-derives every icon the app can render and fails if one would miss the bundle — including the Nuxt UI defaults, found by walking out from the `<U…>` components our templates use into the ones those render internally. A green build, a passing suite, and `nuxt preview` could all miss this, because none of them apply the production CSP
- **Auto-cashout now pays exactly the target multiplier.** Previously it paid whatever multiplier the triggering animation frame landed on — a small overshoot every time, and a large windfall if the tab had been in the background (target 2.00×, paid wherever the round was on return). It now matches `resumeFromInterruption`: paid at the target, to the cent
- **Auto-cashout and crash resolve in game-time order.** A frame gap spanning both the target and the crash point (background tab) previously counted as a loss because the crash was checked first; now a target at or below the crash point wins regardless of frame timing (ties win — see the tie-rule entry under Changed)
- **Jackpot spin economics settle at collection, not when the reels stop.** Leaving the game page mid-spin used to keep the deducted stake but forfeit a winning payout — the payout only applied when the canvas-local animation reached its result phase. Money now moves the moment the trigger is collected; the reel animation is pure presentation (the HUD and floating text still reveal the outcome only when the reels stop)
- **In-flight rounds persist (storage v3), so closing the tab is never an undo.** The session is saved when a bet starts and when a cashout lands — including `currentRound` and the real phase — and a reload resolves the round from the wall clock via the existing resume machinery. Previously the last save was at the prior settle, so closing the tab within ~1.5s of a crash rolled the loss back, "Leave & Save" mid-round silently ate the bet, and browser-Back right after starting a game wiped the session (setup now saves immediately too)
- **Custom setup inputs are clamped to their documented ranges** (house edge 0.5–10%, bankroll $1–$1M, speed 0.25–10×, known game modes). Typed values bypass HTML min/max, so a negative edge could silently produce a player-favorable game and a $0 bankroll started a session stuck at the betting screen. Strategy Lab inputs are clamped the same way (a cashout target below 1.01× "won" every round at a nonsense RTP)
- **Holding Space no longer places a bet and instantly cashes out** — key repeat is ignored

## [0.4.1] - 2026-06-11

### Fixed

- **Icons missing on the deployed site**: @nuxt/icon was fetching icon data from `api.iconify.design` at runtime (static hosting has no server icon endpoint), which the CSP's `connect-src 'self'` blocked — every icon failed to load in production. All 18 icons used by the app are now bundled into the client build (`icon.clientBundle`, ~5.7KB uncompressed), so there are zero runtime icon requests. Pre-existing bug, not a 0.4.0 regression — `connect-src 'self'` has been in the CSP since the first Netlify config

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
