# Flameout — Doc 00: Master Design Document

## Metaincognita Casino Simulator Suite

**Project:** Flameout — Crash Game Simulator
**Document:** 00 — Master Design Document
**Version:** 1.0
**Date:** April 5, 2026
**Author:** Chris
**Status:** Draft

---

## 1. Project Overview

Flameout is a browser-based crash game simulator built for the Metaincognita casino education suite. It simulates the crash game format — the fastest-growing new vertical in casino gaming since 2018 — in which a multiplier rises continuously from 1.00× until it "crashes" at a random point, and the player must cash out before the crash to win.

The name derives from the aviation term *flameout*: the failure of a jet engine's combustion, causing sudden loss of thrust. In a crash game, the multiplier is the engine — it climbs, it roars, and at some unpredictable moment, it flames out. The player's only decision is when to bail.

Flameout is not a gambling platform. No real money is wagered. It is an educational simulator designed to let players experience crash game mechanics, explore the underlying mathematics, and develop an intuitive understanding of probability, expected value, house edge, and the gambler's fallacy — all within a safe, zero-risk environment.

### 1.1 Suite Context

Flameout joins the Metaincognita casino simulator suite alongside:

- **Roulette** — European, American, and Triple Zero variants
- **Blackjack** — Full 13-document design suite complete
- **NLH Hold'em** — No-Limit Hold'em poker simulator
- **Video Poker** — Multi-variant video poker simulator
- **Craps** — Full table with all standard wagers
- **PachinkoParlor** — Physics-based pachinko simulator (Phaser 3 + Matter.js)

Flameout is the first simulator in the suite to model a game that originated in the digital-native/crypto casino era rather than from a physical casino floor tradition. It also represents the simplest visual build in the suite while offering the richest mathematical education layer, owing to the crash game's elegant and fully transparent probability model.

### 1.2 What Is a Crash Game?

A crash game is a multiplier-based gambling game that emerged from the cryptocurrency casino community around 2017. The format was pioneered by Eric Springer's Moneypot and popularized globally by Spribe's Aviator (2019), which remains the dominant title worldwide.

The core mechanic:

1. A multiplier starts at 1.00× and rises continuously in real time.
2. The multiplier is visualized — typically as a rising curve on a graph, with a small themed sprite (plane, rocket, spaceman) riding the tip of the curve.
3. At a random point determined before the round begins, the game "crashes" and the multiplier freezes.
4. The player must press a cash-out button before the crash. If they cash out in time, their bet is multiplied by the value shown at the moment of cash-out. If the crash occurs first, they lose the entire bet.

Rounds last between 5 and 60 seconds depending on where the crash point lands. Most implementations run 80–120 rounds per hour.

The format has become one of the fastest-growing verticals in online casino gaming, driven by its simplicity, fast pace, social/multiplayer dynamics, mobile-first design, and appeal to younger demographics who find traditional slots unengaging.

Major commercial titles include Aviator (Spribe), JetX (SmartSoft Gaming), Spaceman (Pragmatic Play), Crash X (Turbo Games), and various platform-native implementations (Stake Crash, BC.Game Crash).

---

## 2. How the Game Works

### 2.1 Round Lifecycle

Each round of Flameout follows a strict state machine:

**BETTING → RUNNING → CRASHED → SETTLING**

1. **BETTING phase** (configurable; default 5 seconds): The player places their bet. A countdown timer is visible. The game canvas shows the previous round's crash point and a "Place Your Bet" prompt. The player can set a manual bet amount or use preset chip values. They may also configure an auto-cashout target (e.g., "cash me out automatically at 2.00×").

2. **RUNNING phase** (variable duration): The multiplier begins at 1.00× and rises. The curve draws itself across the canvas in real time. The multiplier value is displayed prominently and updates continuously. The player can press the cash-out button at any time. If an auto-cashout target was set and the multiplier reaches it, cash-out occurs automatically.

3. **CRASHED phase** (instant): The multiplier freezes. The visual theme triggers a crash animation (the curve stops, the sprite explodes or disappears, the multiplier flashes red). If the player had not yet cashed out, the bet is lost.

4. **SETTLING phase** (brief): The round result is recorded. The player's bankroll is updated (payout credited if cashed out, bet deducted if not). The crash point is added to the round history strip. The game transitions back to BETTING for the next round.

### 2.2 Player Controls

- **Bet amount input**: Manual entry or preset chip values. Range: $0.10 to $1,000 (simulated).
- **Cash-out button**: Active only during the RUNNING phase. Single press cashes out at the current displayed multiplier.
- **Auto-cashout slider/input**: Set a target multiplier before the round. If the game reaches that multiplier, cash-out is automatic. This is the primary "strategy" control.
- **Auto-bet toggle**: Repeat the same bet amount across consecutive rounds without manual re-entry.
- **Speed control**: For simulation/education mode — run rounds at 1×, 2×, 5×, or instant speed to observe long-run convergence.

### 2.3 Visual Design

The crash game's visual requirements are minimal compared to other Metaincognita simulators. The primary display elements are:

**Game Canvas** (HTML `<canvas>` or inline SVG):
- A coordinate grid/graph area where the X-axis represents elapsed time and the Y-axis represents the multiplier value.
- A curve (line path) that draws itself in real time from left to right, rising as the multiplier increases. The curve's slope accelerates as the multiplier grows.
- A small themed sprite positioned at the tip of the curve (Flameout's theme is a stylized jet/afterburner flame — consistent with the flameout naming).
- Optional particle trail behind the sprite for visual flair.
- On crash: the sprite bursts, the curve stops, the multiplier display flashes red.

**Surrounding UI** (standard Nuxt UI components):
- Bet controls panel (below or beside the canvas).
- Round history strip showing the last 20–30 crash points as colored badges (green for high crashes, red/orange for low ones).
- Bankroll display.
- Session statistics panel.
- Educational analytics panel (expandable/collapsible).

The visual simplicity is deliberate. Crash games derive their tension from the rising number, not from visual spectacle. The UI should feel clean, modern, and data-forward — more Bloomberg terminal than Las Vegas carpet.

---

## 3. The Mathematics

The mathematical model behind crash games is one of the most elegant in all of casino gaming. The probability structure is fully transparent, the house edge mechanism is simple, and — most importantly for an educational simulator — every key property can be demonstrated empirically by running simulated rounds.

### 3.1 Crash Point Distribution

The crash point for each round is drawn from an inverse distribution. For a game with Return to Player (RTP) percentage `r` (expressed as a decimal, e.g., 0.97 for 97% RTP):

```
P(multiplier ≥ m) = r / m
```

This means the probability of the multiplier reaching at least `m` before crashing is simply `r` divided by `m`. For a 97% RTP game:

| Target Multiplier | P(reaching it) | Implied Odds |
|---|---|---|
| 1.01× | 96.04% | ~24:1 on |
| 1.10× | 88.18% | ~7.4:1 on |
| 1.50× | 64.67% | ~1.8:1 on |
| 2.00× | 48.50% | ~1.06:1 against |
| 3.00× | 32.33% | ~2.1:1 against |
| 5.00× | 19.40% | ~4.2:1 against |
| 10.00× | 9.70% | ~9.3:1 against |
| 20.00× | 4.85% | ~19.6:1 against |
| 50.00× | 1.94% | ~50.5:1 against |
| 100.00× | 0.97% | ~102:1 against |
| 1,000.00× | 0.097% | ~1,030:1 against |

Note the crossover: at 2.00×, the probability drops just below 50%. A "double your money" bet in a crash game is *slightly worse* than a coin flip — the house edge makes the difference.

### 3.2 Generating Crash Points

To generate a crash point from a uniform random number `R` in [0, 1):

```
crashPoint = floor(100 * r / (1 - R)) / 100
```

Where `r` is the RTP as a decimal. This produces the correct inverse distribution. When `R` is close to 0, the crash point is near 1.00× (instant crash). When `R` is close to 1, the crash point approaches infinity.

**Instant crashes (the house edge mechanism):** A percentage of rounds crash at exactly 1.00×, meaning every player loses regardless of strategy. The frequency of instant crashes equals the house edge: a 3% house edge game produces approximately 3% instant crashes. This is the single mechanism by which the casino enforces its edge. Without instant crashes, the expected return would be 100%.

Implementation note: In real-money provably fair implementations, the instant crash is enforced by checking whether the first portion of the hash is divisible by a modulus (e.g., divisible by 101 for a ~1% house edge). For Flameout's educational simulator, the simplified formula above produces the correct distribution.

### 3.3 Expected Value Invariance

This is the most important mathematical property of crash games, and the central educational lesson of Flameout:

**The expected value of every bet is identical regardless of the cashout target.**

Proof for a $1 bet at RTP `r`:

```
EV = P(win) × payout − P(lose) × bet
EV = (r/m) × m − (1 − r/m) × 1
EV = r − 1 + r/m − r/m
EV = r − 1
```

The multiplier `m` cancels out completely. For a 97% RTP game, EV = −$0.03 per dollar wagered, whether the player cashes out at 1.10× or 500×.

This means:

- There is no "optimal" cashout target.
- Conservative strategies (low cashout) and aggressive strategies (high cashout) produce the same long-run loss rate.
- The only thing that changes is *variance* — how wildly results swing in the short term.
- Low cashout targets produce frequent small wins with occasional total losses.
- High cashout targets produce frequent total losses with occasional large wins.
- Over thousands of rounds, both converge to the same house edge.

This property makes crash games "strategy-proof" from a pure expected value standpoint. The game is entirely about risk tolerance, bankroll management, and (from a psychological standpoint) the illusion of control.

### 3.4 Variance and Volatility

While EV is invariant, variance is not. The standard deviation of returns per round increases dramatically with higher cashout targets:

- Auto-cashout at 1.10×: Very low variance. You win ~88% of rounds but only gain 10% per win. Bankroll grinds down slowly.
- Auto-cashout at 2.00×: Medium variance. Win ~48.5% of rounds, doubling each time. Feels like a coin flip with a slight house lean.
- Auto-cashout at 10.00×: High variance. Win ~9.7% of rounds, but each win is 10× the bet. Long losing streaks are common.
- Auto-cashout at 100.00×: Extreme variance. Win ~0.97% of rounds. You might play 200 rounds before hitting one, but when you do, it pays 100×.

This variance spectrum is a core part of Flameout's educational value. Players can viscerally experience how different strategies *feel* different despite being mathematically equivalent in the long run.

### 3.5 The Gambler's Fallacy in Crash Games

Crash games are particularly susceptible to the gambler's fallacy because the round history is prominently displayed. After seeing five consecutive crashes below 2.00×, it *feels* like a high crash is "due." It is not. Each round is an independent random event. The probability of the next round reaching 10.00× is exactly 9.7% (at 97% RTP) regardless of what happened in the previous 5, 50, or 500 rounds.

Flameout should expose this explicitly through its analytics layer — showing conditional probabilities, streak analysis, and empirical demonstrations that prior rounds have zero predictive value.

### 3.6 The Martingale and Other Betting Systems

The Martingale strategy (double your bet after each loss, revert to base after each win) is popular among crash game players. It does not change the expected value. It changes the *distribution* of outcomes: frequent small wins punctuated by catastrophic losses when a long losing streak exhausts the bankroll or hits the table maximum.

Flameout's strategy lab mode should allow players to configure and simulate common betting systems (Martingale, D'Alembert, Fibonacci, fixed-bet) over thousands of rounds, then compare the distributions of outcomes — visually demonstrating that all systems converge to the same house edge.

### 3.7 House Edge Comparison

For educational context, Flameout should present crash game house edges alongside other casino games:

| Game | Typical House Edge |
|---|---|
| Crash (99% RTP, e.g., Stake) | 1.0% |
| Blackjack (basic strategy) | 0.5% |
| Crash (97% RTP, e.g., Aviator) | 3.0% |
| Craps (Pass Line) | 1.41% |
| European Roulette | 2.70% |
| American Roulette | 5.26% |
| Crash (95% RTP, e.g., F777) | 5.0% |
| Slots (average) | 2–10% |

Crash games with 99% RTP are among the lowest house edges in casino gaming, comparable to well-played blackjack. However, the high round velocity (100+ rounds per hour) means the hourly cost can still be significant. At 97% RTP and $10 per bet, 100 rounds per hour costs $30/hour in expected losses.

### 3.8 Configurable Parameters

For educational flexibility, Flameout should allow the player to adjust:

- **House edge / RTP**: Preset options at 99%, 97%, 95%, or custom. Changes the crash point distribution and instant-crash frequency accordingly.
- **Starting bankroll**: Default $1,000 simulated.
- **Bet limits**: Min/max bet per round.
- **Round speed**: Real-time, accelerated, or instant (for batch simulation).

---

## 4. Feature Summary

### 4.1 Core Game

- Single-player crash game simulation with full round lifecycle (BETTING → RUNNING → CRASHED → SETTLING).
- Real-time animated multiplier curve on HTML canvas.
- Manual cash-out button and auto-cashout target input.
- Auto-bet for consecutive rounds.
- Configurable house edge (99%, 97%, 95%, custom).
- Simulated bankroll tracking with session persistence.
- Round history strip showing last N crash points.

### 4.2 Educational / Analytics Layer

- **Probability Explorer**: Interactive table/chart showing the probability of reaching any multiplier, given the current house edge setting. Player enters a target multiplier and sees the exact probability, EV, and implied odds.
- **EV Invariance Demonstrator**: Side-by-side comparison of two or more auto-cashout strategies running over the same sequence of crash points. Visually proves that all strategies converge to the same loss rate.
- **Session Statistics Dashboard**: Running totals of rounds played, win/loss count, total wagered, total returned, actual RTP achieved, current bankroll, peak bankroll, and drawdown.
- **Crash Point Distribution Chart**: Histogram of observed crash points vs. theoretical distribution. Converges over many rounds.
- **Streak Analysis**: Tracks consecutive wins/losses, consecutive crashes below a threshold, and demonstrates empirically that streaks are statistically expected and have no predictive value.
- **Strategy Lab** (simulation mode): Configure a betting system (Martingale, D'Alembert, Fibonacci, flat), set parameters, and run N rounds (100, 1,000, 10,000) instantly. View bankroll curves, outcome distributions, and convergence to house edge for each system.
- **Hourly Cost Calculator**: Given bet size, rounds per hour, and RTP, shows the expected hourly cost of play.
- **House Edge Comparison Table**: Contextualizes crash game odds against other casino games in the Metaincognita suite.

### 4.3 Provably Fair Education Module

Crash games pioneered the "provably fair" concept in online gambling — using cryptographic hash chains to prove that outcomes were predetermined and unmanipulated. Flameout should include an optional educational module explaining:

- How a hash chain works (a server seed repeatedly fed through SHA-256).
- How the crash point is derived from a hash.
- How a player can verify a round's fairness after the fact.
- Why this mechanism prevents both player prediction and casino manipulation.

This is not a core gameplay feature but a valuable educational sidebar, particularly given the cryptographic literacy angle. Implementation could be a collapsible panel or a dedicated "How It Works" page.

---

## 5. Technology Stack

### 5.1 Core Stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 4+ |
| UI Library | Nuxt UI v4+ |
| State Management | Pinia |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Package Manager | Yarn |
| Deployment | Netlify (SPA mode) |
| Domain | flameout.metaincognita.com |

### 5.2 Rendering

The game canvas uses the native HTML Canvas 2D API (`<canvas>` element with `CanvasRenderingContext2D`). No game engine (Phaser, PixiJS, etc.) is required. The visual demands of a crash game — drawing a line path, positioning a sprite, rendering particle effects on crash — fall well below the threshold where a game engine adds value.

The rendering loop uses `requestAnimationFrame` for smooth 60fps animation during the RUNNING phase, throttled or idle during BETTING and SETTLING phases.

The surrounding UI (bet controls, analytics panels, history strip, statistics dashboard) is standard Nuxt UI component territory — no canvas rendering needed.

### 5.3 Architecture

```
composables/
  useFlameoutEngine.ts      — Headless core: RNG, crash point generation,
                               round state machine, bankroll logic
  useFlameoutRenderer.ts    — Canvas rendering: curve drawing, sprite
                               positioning, crash animation, particles
  useFlameoutAnalytics.ts   — Session statistics, distribution tracking,
                               streak analysis, strategy simulation
  useFlameoutStrategy.ts    — Betting system definitions (Martingale,
                               D'Alembert, Fibonacci, flat) and batch
                               simulation runner

stores/
  flameout.ts               — Pinia store: game state, bankroll, settings,
                               round history, session stats

components/
  FlameoutCanvas.vue        — Canvas element + rendering integration
  FlameoutControls.vue      — Bet input, cash-out button, auto-cashout
  FlameoutHistory.vue       — Round history strip (crash point badges)
  FlameoutStats.vue         — Session statistics dashboard
  FlameoutProbability.vue   — Probability explorer / EV calculator
  FlameoutStrategyLab.vue   — Batch strategy simulation and comparison
  FlameoutSettings.vue      — House edge, speed, bankroll configuration

pages/
  index.vue                 — Main game view
  learn.vue                 — Educational content (provably fair, math)
```

### 5.4 Headless Core Engine

Following the pattern established across the Metaincognita suite, the game logic lives in a headless engine composable (`useFlameoutEngine`) that is fully independent of rendering. The engine:

- Generates crash points from a configurable RNG with adjustable house edge.
- Manages the round state machine (BETTING → RUNNING → CRASHED → SETTLING).
- Processes cash-out events and calculates payouts.
- Tracks bankroll, enforces bet limits, and records round history.
- Exposes reactive state for the Pinia store and rendering layer to consume.
- Can run in "instant" mode for batch simulation (no animation, pure math).

The engine should be testable in isolation — unit tests can run thousands of rounds and verify that empirical RTP converges to the configured value.

---

## 6. Design Principles

### 6.1 Accuracy First

Flameout must produce a mathematically correct simulation. The crash point distribution must match the theoretical model. Empirical RTP over large sample sizes must converge to the configured value within expected statistical bounds. No shortcuts, no fudging.

### 6.2 Education Over Entertainment

While the game should feel engaging and responsive, the primary goal is education. Every design decision should prioritize helping the player understand *why* the game works the way it does. The analytics layer is not a secondary feature — it is the point.

### 6.3 No Real Money, No Gambling Promotion

Flameout is an educational simulator. It does not accept real money, does not link to real-money gambling sites, does not encourage gambling, and includes responsible gaming context where appropriate. The simulator exists to demystify casino mathematics, not to promote casino play.

### 6.4 Visual Restraint

The game's visual design should be clean and modern, not flashy or garish. The tension in a crash game comes from the rising number, not from visual noise. The UI should feel closer to a financial dashboard than a casino floor.

### 6.5 Suite Consistency

Flameout follows the same architectural patterns, naming conventions, component structure, and deployment model as the other Metaincognita simulators. A developer (or Claude) familiar with the Roulette or Blackjack codebases should feel immediately at home in Flameout.

---

## 7. Document Suite Roadmap

| Doc | Title | Description |
|---|---|---|
| 00 | Master Design Document | This document. Game overview, math, stack, architecture. |
| 01 | Headless Core Engine | RNG, crash point generation, round state machine, bankroll, strategy simulation engine. |
| 02 | Rendering & Animation | Canvas rendering layer: curve drawing, sprite animation, particle system, crash effects. |
| 03 | Game UI & Controls | Bet panel, cash-out button, auto-cashout, auto-bet, history strip, settings. |
| 04 | Analytics & Education Layer | Probability explorer, EV demonstrator, session stats, distribution charts, streak analysis, strategy lab. |
| 05 | Polish, Testing & Deploy | Responsive design, accessibility, performance optimization, unit/integration tests, Netlify deployment. |
| 06 | Security Considerations | Input validation, RNG integrity, client-side state protection, no real-money surface. |
| 07 | LLM Build Prompt | Self-contained build prompt for Claude: stack, architecture, file structure, per-phase instructions. |
| 08 | Competitive Landscape & Differentiation | Comparison with Aviator, JetX, Spaceman, Stake Crash; Flameout's educational positioning. |
| 09 | Website & Landing Page | Marketing page for flameout.metaincognita.com; integration with metaincognita.com suite listing. |
| 10 | Revision & Gap Analysis | Post-build review: what changed, what was deferred, what gaps remain. |
| 11 | Architecture Decision Records | Key technical decisions and their rationale (Canvas vs. SVG, no game engine, RNG approach, etc.). |
| 12 | Use Cases & Player Journeys | Detailed user scenarios: first-time player, strategy experimenter, math student, gambler's fallacy explorer. |

---

## 8. Open Questions

All resolved at this time. The following decisions are recorded:

1. **Game engine?** No. Nuxt + Canvas 2D API. Phaser 3 adds weight without proportional value for this game's visual requirements.
2. **Theme?** Jet/afterburner flame, consistent with "Flameout" naming. Stylized flame sprite, not photorealistic.
3. **Multiplayer simulation?** No live multiplayer. The simulator is single-player. The social feed (other players' bets/cashouts) that real crash games display could be simulated with synthetic bot players in a future enhancement, but is not a core requirement.
4. **Provably fair implementation?** Educational explainer only, not a full cryptographic verification system. The simulator's RNG does not need to be provably fair since no real money is at stake — but explaining how provably fair works is part of the educational mission.
5. **Mobile support?** Yes. Canvas rendering scales naturally, and the surrounding UI uses responsive Nuxt UI components. Touch-friendly cash-out button is essential.
6. **Persist session across page reloads?** Yes, via localStorage (bankroll, settings, round history). Reset option available.

---

## 9. References

### 9.1 Game Origins

- **Moneypot** (Eric Springer, ~2017): First crash game, built for Bitcoin community education.
- **Aviator** (Spribe, 2019): Dominant commercial crash game; 97% RTP, SHA-512 provably fair, 30–60 second rounds.
- **Bustabit** (early crypto casino implementation): Pioneered the hash chain provably fair model widely adopted by later crash games.

### 9.2 Mathematical References

- Crash point probability: `P(multiplier ≥ m) = RTP / m`
- Crash point generation: `crashPoint = floor(100 × RTP / (1 − R)) / 100` where `R ~ Uniform(0, 1)`
- Expected value invariance proof: EV = RTP − 1, independent of cashout target `m`
- Instant crash frequency ≈ house edge percentage

### 9.3 Provably Fair Algorithm (Bustabit Model)

- Pre-generate a chain of N SHA-256 hashes (each hash is the SHA-256 of the next game's hash, played in reverse order).
- Salt each hash with a public client seed (e.g., a future blockchain block hash) via HMAC-SHA256.
- Extract 52 bits from the resulting hash to derive the crash point.
- Enforce instant crash when the first 8 hex characters of the hash are divisible by a modulus (e.g., 101 for ~1% house edge).
- Formula: `crashPoint = floor((100 × 2^52 − H) / (2^52 − H)) / 100` where `H` is the 52-bit integer from the hash.

---

*Flameout is part of the Metaincognita casino simulator suite: educational tools for understanding the mathematics of casino games. No real money. No gambling promotion. Just math, probability, and the eternal human impulse to push the button one more time.*
