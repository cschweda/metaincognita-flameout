# Flameout

**A crash game simulator for learning casino mathematics.**

Watch the multiplier climb. Cash out before the crash. Then see why the house always wins.

Flameout is part of the [Metaincognita](https://metaincognita.com) casino simulator suite. No real money is wagered. This is an educational tool designed to demystify the mathematics behind one of the fastest-growing game formats in online gambling.

---

## What Is a Crash Game?

A crash game is a multiplier-based gambling format where:

1. A multiplier starts at 1.00× and rises continuously in real time
2. At a random, predetermined point, the game "crashes" and the multiplier freezes
3. The player must press a cash-out button before the crash to win
4. If the crash occurs first, the entire bet is lost

Rounds last between 5 and 60 seconds. Most implementations run 80–120 rounds per hour.

The format was born in the cryptocurrency casino community in 2014 and has since become one of the largest single-game verticals in online gambling, with the dominant title (Aviator by Spribe) processing an estimated €160 billion in wagers in 2025 alone.

---

## Features

### Core Game
- Single-player crash game with full round lifecycle (WAITING → RUNNING → CRASHED → SETTLING)
- Real-time animated multiplier curve on HTML canvas with jet sprite and afterburner flame trail
- Particle effects: trail particles during flight, explosion burst on crash
- Large, prominent action buttons: green "Place Bet", pulsing amber "CASH OUT"
- Round stops immediately on cashout with profit/loss display
- Auto-cashout: set a target multiplier for automatic cashout
- Auto-bet: automatically places the same bet each round (starts immediately, no waiting)
- Configurable house edge: 1% (99% RTP), 3% (97% RTP), 5% (95% RTP), or custom
- Adjustable game speed (0.5× to 5×)
- Simulated bankroll with session persistence (localStorage)
- Color-coded crash point history strip with hover tooltips showing round details and payout math
- "How to Play" modal on first visit
- New Game button to reset session

### Analytics & Education
- **Probability Explorer**: Enter any multiplier target and see the exact probability, implied odds, break-even rate, and EV
- **Session Statistics**: Running totals of rounds played, win/loss, total wagered, empirical RTP, streaks, peak balance, max drawdown
- **Crash Point Distribution**: Observed vs. theoretical distribution histogram — converges over many rounds (law of large numbers)
- **Streak Analysis**: Current and historical streak tracking with conditional probability display
- **Strategy Lab** (batch simulation): Configure Flat, Martingale, D'Alembert, Fibonacci, or Paroli systems and simulate 100K+ rounds instantly

### UI
- Dark mode interface (Bloomberg terminal aesthetic)
- Setup screen → Game screen with right-hand stats sidebar
- Bottom navigation: History and Analysis pages with GitHub link
- Keyboard controls (Space to bet/cashout)
- Accessible modals with screen reader support
- Responsive layout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 4 |
| UI | Nuxt UI v4 |
| State | Pinia |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Package Manager | pnpm |
| Testing | Vitest |
| Deployment | Netlify (SPA) |

---

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Lint with ESLint |
| `pnpm typecheck` | TypeScript type checking |

---

## Architecture

```
app/
  composables/
    useFlameoutEngine.ts       — Round state machine, cashout, bankroll
    useFlameoutAnalytics.ts    — Session stats, distributions, probabilities
    useFlameoutStrategy.ts     — Betting systems, batch simulation
  stores/
    flameout.ts                — Pinia store (single source of truth)
  types/
    flameout.ts                — All shared interfaces and enums
  utils/
    flameout-math.ts           — Pure math: crash point gen, probability, EV
    flameout-rng.ts            — Seeded PRNG (mulberry32)
  components/flameout/
    Canvas.vue                 — Multiplier curve rendering
    Controls.vue               — Bet input, cashout button, auto-cashout
    HistoryStrip.vue           — Color-coded crash point badges
    Stats.vue                  — Session/Probability sidebar
  pages/
    index.vue                  — Setup screen
    game.vue                   — Main game
    history.vue                — Round history table
    analysis.vue               — Session analysis dashboard
  layouts/
    default.vue                — App shell (top bar, bottom bar)
```

The headless engine pattern separates game logic from rendering. All math lives in pure functions (`flameout-math.ts`), all state in the Pinia store, and all UI in Vue components. The engine can run in real-time (animated) or instant mode (batch simulation) with no code changes.

---

## The Mathematics of Crash Games

The mathematical model behind crash games is one of the most elegant in all of casino gaming. The probability structure is fully transparent, the house edge mechanism is simple, and every key property can be demonstrated empirically by running simulated rounds.

### Crash Point Distribution

The crash point for each round is drawn from an inverse distribution. For a game with house edge `h` (e.g., 0.03 for 3%), the Return to Player (RTP) is `r = 1 - h`:

```
P(multiplier ≥ m) = r / m
```

The probability of the multiplier reaching at least `m` before crashing is simply the RTP divided by `m`.

For a 97% RTP game:

| Target | Probability | Implied Odds |
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

Note the crossover: at 2.00×, the probability drops just below 50%. A "double your money" bet is *slightly worse* than a coin flip — the house edge makes the difference.

### Generating Crash Points

To generate a crash point from a uniform random number `R ∈ [0, 1)`:

```
crashPoint = floor(100 × r / (1 - R)) / 100
```

When `R` is close to 0, the crash point is near 1.00× (instant crash). When `R` is close to 1, the crash point approaches infinity.

**Instant crashes** are the house edge mechanism. A percentage of rounds crash at exactly 1.00×, meaning every player loses regardless of strategy. The frequency of instant crashes equals the house edge: a 3% house edge produces approximately 3% instant crashes. This is the *sole* mechanism by which the casino enforces its edge. Without instant crashes, the expected return would be 100%.

### Expected Value Invariance

This is the most important mathematical property of crash games and the central educational lesson of Flameout:

**The expected value of every bet is identical regardless of the cashout target.**

Proof for a $1 bet at RTP `r`, cashing out at multiplier `m`:

```
EV = P(win) × payout − P(lose) × bet
EV = (r/m) × m − (1 − r/m) × 1
EV = r − 1 + r/m − r/m
EV = r − 1
```

The multiplier `m` cancels out completely. For a 97% RTP game, EV = −$0.03 per dollar wagered, whether the player cashes out at 1.10× or 500×.

This means:
- There is **no "optimal" cashout target**
- Conservative strategies (low cashout) and aggressive strategies (high cashout) produce the **same long-run loss rate**
- The only thing that changes is **variance** — how wildly results swing in the short term
- Low targets: frequent small wins, occasional total losses
- High targets: frequent total losses, occasional large wins
- Over thousands of rounds, **all strategies converge to the same house edge**

This property makes crash games "strategy-proof" from a pure EV standpoint. The game is entirely about risk tolerance, bankroll management, and the psychological illusion of control.

### Variance and Volatility

While EV is invariant, variance is not. The standard deviation of returns per round increases dramatically with higher cashout targets:

- **Auto-cashout at 1.10×**: Very low variance. Win ~88% of rounds but only gain 10% per win. Bankroll grinds down slowly.
- **Auto-cashout at 2.00×**: Medium variance. Win ~48.5% of rounds, doubling each time. Feels like a coin flip with a slight house lean.
- **Auto-cashout at 10.00×**: High variance. Win ~9.7% of rounds, but each win is 10× the bet. Long losing streaks are common.
- **Auto-cashout at 100.00×**: Extreme variance. Win ~0.97% of rounds. You might play 200 rounds before hitting one, but it pays 100×.

### The Gambler's Fallacy

Crash games are particularly susceptible to the gambler's fallacy because the round history is prominently displayed. After seeing five consecutive crashes below 2.00×, it *feels* like a high crash is "due." It is not. Each round is an independent random event. The probability of the next round reaching 10.00× is exactly 9.7% (at 97% RTP) regardless of what happened in the previous 5, 50, or 500 rounds.

Flameout exposes this explicitly through its analytics layer — showing conditional probabilities and empirical demonstrations that prior rounds have zero predictive value.

### Betting Systems Don't Work

The Martingale strategy (double your bet after each loss, revert to base after each win) is popular among crash game players. It does not change the expected value. It changes the *distribution* of outcomes: frequent small wins punctuated by catastrophic losses when a long losing streak exhausts the bankroll.

Flameout's Strategy Lab allows you to simulate Martingale, D'Alembert, Fibonacci, Paroli, and flat betting over thousands of rounds, then compare — visually demonstrating that all systems converge to the same house edge.

### House Edge in Context

| Game | Typical House Edge |
|---|---|
| Crash (99% RTP) | 1.0% |
| Blackjack (basic strategy) | 0.5% |
| Craps (Pass Line) | 1.41% |
| European Roulette | 2.70% |
| Crash (97% RTP, e.g. Aviator) | 3.0% |
| American Roulette | 5.26% |
| Crash (95% RTP) | 5.0% |
| Slots (average) | 2–10% |

Crash games with 99% RTP are among the lowest house edges in casino gaming. However, the high round velocity (100+ rounds per hour) means the hourly cost can still be significant. At 97% RTP and $10 per bet, 100 rounds per hour costs **$30/hour** in expected losses.

---

## The Provably Fair System

Crash games pioneered the "provably fair" concept in online gambling — using cryptographic hash chains to prove that outcomes were predetermined and unmanipulated. The system is one of the most elegant applications of cryptographic hashing outside of blockchain consensus itself, and it emerged from the same community that built Bitcoin.

### The Problem: Why Can't You Just Trust the Casino?

In a traditional online casino, a Random Number Generator (RNG) runs on the casino's server. The player sends a bet, the server generates a random outcome, and the server tells the player what happened. The player has no way to verify that the outcome was truly random or that the casino didn't manipulate it after seeing the bet.

Third-party auditors (like eCOGRA or GLI) certify that the RNG is fair by testing large samples of outcomes. But the player is still trusting: (a) the casino to actually use the certified RNG, (b) the auditor to be competent and honest, and (c) that no one has tampered with the system between audits.

Provably fair systems eliminate all three trust requirements. The player can verify every single outcome themselves, using nothing but a hash function and the data the casino publishes.

### The Core Insight: Hash Functions Are One-Way

The entire system rests on a single property of cryptographic hash functions like SHA-256:

- Given an input, computing the hash is trivial (nanoseconds).
- Given a hash, finding the input is computationally infeasible (centuries, even with all the world's computing power).
- Any change to the input — even flipping a single bit — produces a completely different hash.

This means a casino can **commit** to an outcome by publishing its hash, without revealing the outcome itself. Later, when the casino reveals the actual outcome, anyone can verify it matches the committed hash. If the casino tried to change the outcome after committing, the hash wouldn't match.

### Step 1: The Hash Chain (Pre-Generating All Outcomes)

Before a single game is played, the casino generates the outcomes for every future round — potentially millions of them — using a **hash chain**:

```
Game 10,000,000:  seed₀ = random 256-bit value
Game  9,999,999:  seed₁ = SHA-256(seed₀)
Game  9,999,998:  seed₂ = SHA-256(seed₁)
...
Game          1:  seed₉,₉₉₉,₉₉₉ = SHA-256(seed₉,₉₉₉,₉₉₈)
```

The chain is generated in reverse: the casino picks a random starting seed, hashes it to get the next game's seed, hashes that to get the one after, and so on for millions of rounds. The games are then **played in reverse order** — Game 1 uses the last seed in the chain, Game 2 uses the second-to-last, and so on.

This reverse ordering is critical. Before Game 1 is played, the casino publishes `seed₉,₉₉₉,₉₉₉` (the hash of Game 1's seed). After Game 1 is played, the casino reveals Game 1's actual seed. The player can verify that `SHA-256(revealed_seed) == published_hash`. This proves the seed was determined before the game started.

But here's the key insight: because each seed is the hash of the *previous* game's seed in the chain, revealing Game 1's seed also **commits** to Game 2's outcome. The player knows that Game 2's seed must hash to Game 1's seed. The casino cannot change it.

This cascading commitment means the entire sequence of 10 million games was locked in before the first game was played. The casino cannot manipulate any individual outcome without breaking the chain.

### Step 2: The Client Seed (Preventing Casino Pre-Knowledge)

There's a subtlety: if the casino generated all the outcomes, couldn't they have arranged the sequence to be unfavorable to specific players or betting patterns?

To prevent this, a **client seed** (or public salt) is introduced. This is a value the casino cannot control or predict at the time it generates the hash chain. Common choices:

- **A future Bitcoin block hash**: The casino commits to using the hash of, say, Bitcoin block #850,000 as the client seed. Since no one can predict what that hash will be until the block is mined, the casino cannot tailor its hash chain to that seed.
- **A public random beacon**: Services like NIST's Randomness Beacon or drand provide publicly verifiable random values at scheduled intervals.
- **Player-provided seeds**: Some implementations let each player contribute their own seed, which is combined with the server seed via HMAC.

The final game outcome is derived from `HMAC-SHA256(server_seed, client_seed)`, not from the server seed alone. Since the client seed is unknown when the hash chain is generated, the casino cannot predict which crash points will result — even though it chose the server seeds.

### Step 3: Deriving the Crash Point from a Hash

Given the combined hash (a 64-character hexadecimal string), the crash point is derived mathematically:

```
hash = HMAC-SHA256(server_seed, client_seed)

// Take the first 52 bits (13 hex characters) as an integer
H = parseInt(hash.substring(0, 13), 16)

// Enforce instant crash (house edge)
// If H is divisible by the house edge modulus, crash at 1.00×
// For 1% house edge: modulus = 101 → ~0.99% of outcomes
// For 3% house edge: modulus = 34 → ~2.94% of outcomes
if (H % 101 === 0) return 1.00

// Otherwise, map to crash point using the inverse distribution
crashPoint = floor((100 × 2^52 - H) / (2^52 - H)) / 100
```

This formula produces the correct inverse distribution `P(crash ≥ m) = r/m` while being fully deterministic from the hash. The 52-bit space (4.5 quadrillion possible values) provides sufficient resolution for crash points ranging from 1.00× to astronomical multipliers.

The modulus check for instant crashes is particularly elegant: it uses the *divisibility* of a portion of the hash, which is uniformly distributed, to enforce the exact house edge percentage. A modulus of 101 means exactly 1 in 101 hashes will be divisible, yielding a 0.99% instant crash rate (and thus a ~1% house edge). Bustabit uses this exact approach.

### Step 4: Player Verification

After each game, the casino reveals:
- The **server seed** for that game
- The **client seed** that was used

The player verifies:

1. `SHA-256(revealed_server_seed) == previously_published_hash` — This proves the server seed was committed before the game started.
2. `derive_crash_point(HMAC-SHA256(revealed_server_seed, client_seed)) == actual_crash_point` — This proves the crash point was correctly derived from the committed seed.
3. The revealed server seed becomes the expected hash for the *next* game, maintaining the chain.

Any player can run these checks independently. No trust in the casino, the auditor, or anyone else is required. The mathematics are self-verifying.

### Why This Matters Beyond Gambling

The provably fair system is a practical demonstration of several fundamental cryptographic concepts:

- **Commitment schemes**: Committing to a value without revealing it, then proving you didn't change it later. This is the same principle used in sealed-bid auctions, voting protocols, and zero-knowledge proofs.
- **Hash chains**: The same structure underlies blockchain technology, certificate transparency logs, and Git's version control system.
- **HMAC (Hash-based Message Authentication Code)**: Combining a secret key with a message to produce an unforgeable authentication tag — the same primitive used in API authentication, JWT tokens, and TLS.
- **Deterministic randomness**: Deriving apparently random outputs from deterministic inputs in a way that's verifiable — the foundation of deterministic wallets (BIP-32), key derivation functions, and pseudorandom function families.

The provably fair crash game is, in essence, a toy example of the same cryptographic primitives that secure billions of dollars in cryptocurrency and internet infrastructure. It's one of the most accessible demonstrations of why hash functions are useful.

### Limitations

Provably fair systems guarantee that the casino didn't manipulate outcomes *after* committing to the hash chain. They do *not* guarantee:

- That the RNG used to generate the initial seed was truly random (a compromised RNG could produce a subtly biased chain)
- That the casino's implementation is bug-free
- That the casino won't simply shut down and refuse to reveal seeds
- That the house edge is what the casino claims (the player must verify the modulus and formula)

In practice, the open-source community around crypto casinos provides significant oversight. Bustabit's verification code is public, and independent scripts exist to verify entire game histories after the fact.

### Flameout's Approach

Flameout is an educational simulator — no real money is at stake, so a full provably fair implementation would be security theater. Instead, Flameout uses client-side `Math.random()` for live play and a seeded PRNG (mulberry32) for reproducible strategy comparisons. The educational value lies in *explaining* how provably fair works, not in implementing it.

---

## A Brief History of Crash Games

### Origins: MoneyPot and the Bitcointalk Forum (2014)

The crash game was born not on a casino floor or in a game studio, but on the **Bitcointalk forum** — the primordial message board of the cryptocurrency community.

In July 2014, a Canadian developer named **Eric Springer**, posting under the handle "espringe," introduced a game called **MoneyPot**. The concept was deceptively simple: a multiplier starts at 1× and rises until it "crashes." Players bet on when to cash out. If they bail before the crash, they multiply their Bitcoin wager. If they don't, they lose it.

Springer drew his inspiration from the one thing every crypto enthusiast in 2014 understood viscerally: **volatility**. Cryptocurrencies rocket in value until, one day, they go to zero. The people who exit in time get rich. The people who hold too long get wiped out. Springer took that dynamic — a dynamic his audience was already emotionally addicted to — and turned it into a game.

MoneyPot was visually primitive: a bare x/y-axis graph with a single line that went up until it didn't. There was no plane, no rocket, no astronaut. Just a line on a chart — which, for an audience of Bitcoin traders, was exactly the right aesthetic. As one industry observer later noted, it looked more like a STEM assignment than a game.

Within two months of its announcement, MoneyPot had logged over **250,000 plays** and processed more than **180 BTC** in wagers from **1,750 users**. In September 2014, with Bitcoin hovering around $450, that represented roughly $81,000 in total wagering volume.

Two features proved prescient. First, it was a **social game**: all players bet on the same event simultaneously, creating a shared experience of watching the line rise together. Second, it introduced a **provably fair system** based on cryptographic hash chains — both features that would become standard in the genre.

### The Handoffs: From MoneyPot to Bustabit (2015–2018)

Running a real-money gambling platform as a solo developer proved exhausting. In 2015, Springer sold MoneyPot to **Ryan Havar**, a Bitcointalk community member. Havar rebranded the game as **Bustabit** and introduced the "last-longer bonus" — a prize pool funded by taking a 1% cut of every wager and awarding it to the last player to successfully cash out before each crash. This injected a competitive game-theory element into a pure-chance game: players now had an incentive to wait longer than everyone else.

The community's response was mixed. Some loved the competitive twist. Others saw it as an unnecessary additional edge. The debate foreshadowed a persistent tension in crash game design: how much "game" should be layered on top of the core multiplier mechanic?

Havar eventually sold Bustabit to **Daniel Evans**, who still operates the site. Evans removed the last-longer bonus, added non-cryptocurrency payment options, and — unusually for a gambling operator — allowed **third-party investors to bankroll the game** in exchange for profit shares, turning Bustabit into something like a decentralized casino.

Bustabit also supported **user-created gambling scripts** — automated betting strategies written in JavaScript. This attracted a technically sophisticated user base of amateur quants optimizing algorithms against a 1% house edge, generating content and discussion that kept the platform alive.

### The CS:GO Skin Gambling Connection (2015–2017)

While Bustabit evolved in the crypto niche, crash games were spreading through an unexpected vector: **Counter-Strike: Global Offensive skin gambling sites**.

The CS:GO skin economy — where cosmetic weapon finishes could be traded for real money — had given rise to an entire ecosystem of gambling platforms. Crash was a natural fit: fast, simple, visually straightforward, and easy to implement. By 2016–2017, crash had become a staple alongside coinflip and jackpot games on platforms like CSGOCrash, bringing the format to **millions of gamers** — many of them teenagers who might never have encountered cryptocurrency casinos.

The term "crash gambling" solidified as the genre's name during this period. The CS:GO gambling boom eventually attracted regulatory scrutiny and largely collapsed when Valve shut down the Steam API access that enabled skin trading. But its contribution was significant: it proved crash games had mass appeal far beyond Bitcoin enthusiasts.

### Spribe and the Birth of Aviator (2018–2019)

The leap from crypto niche to mainstream casino came courtesy of **Spribe**, a game studio headquartered in Kyiv, Ukraine. Founded in 2018, Spribe set out to modernize casino content for a generation raised on mobile apps and social media.

CEO **David Natroshvili** has always been candid that he did not invent the crash game. What Spribe did was take the raw mechanics of MoneyPot/Bustabit and apply professional game design, polished UX, and aggressive marketing. As Natroshvili has said: Facebook wasn't the first social network; Apple wasn't first to make mobile phones; Amazon didn't invent e-commerce. They all just did it better.

**Aviator** launched in late 2018 and quickly became a phenomenon. The game replaced the bare chart line with a charming **little red plane** that climbed across the screen, trailing a path behind it. When the crash came, the plane flew away. The mechanic was identical to MoneyPot's, but the presentation was warm, intuitive, and — crucially — **performant on low-end mobile devices with limited bandwidth**.

This last point mattered enormously. Aviator's rise was fueled by markets where smartphone penetration was high but data speeds were low: **Africa, Brazil, India, and Southeast Asia**. A crash game requires almost no data to operate — it's a single number rising on a screen. No 3D graphics, no heavy assets, no streaming video. In regions where players accessed casinos on $100 Android phones over 3G connections, Aviator loaded fast and ran smoothly while slot games stuttered and live dealer games were unplayable.

### The Explosion: $160 Billion and 77 Million Monthly Players (2020–2025)

The COVID-19 pandemic accelerated online gambling globally, and crash games — particularly Aviator — rode the wave. By the end of 2020, nearly every cryptocurrency casino offered a proprietary crash title.

Spribe's trajectory from 2020 onward is staggering:

- **90% market share** of the crash game vertical
- Integration with over **2,000 operators** worldwide
- **77 million monthly active players** as of 2025
- An estimated **€160 billion** in total wagers processed in 2025 — one of the largest single-game betting volumes in online casino history
- Licensing from the UK Gambling Commission, Malta Gaming Authority, and multiple other jurisdictions
- Partnerships with UFC, WWE, and AC Milan, plus ambassadors including UFC fighters Tom Aspinall and Alex Pereira

In Africa, Aviator saw a **53.93% year-on-year rise** in monthly active players in 2024, with the continent accounting for nearly 20% of new global player inflows. In India and Asia-Pacific, monthly active users grew by an astounding **629.67%** in 2024.

Aviator became so popular in Brazil that players developed their own nickname for it: **"Jogo do aviãozinho"** (the little airplane game). It became a grassroots cultural phenomenon, with players searching for the game by name before they even chose which casino to play on — a reversal of the normal acquisition funnel that fundamentally changed the economics of operator-player relationships.

### Why It Caught Fire: The Psychology of the Crash

Several psychological factors converge to make crash games uniquely compelling:

**The illusion of control.** Unlike a slot machine, where you press a button and fate decides, a crash game makes you feel like *you* decided the outcome. You chose when to cash out. You could have waited longer. You could have bailed sooner. This sense of agency — even though the EV math is identical regardless of your choice — is profoundly engaging.

**Real-time shared experience.** Watching the multiplier climb alongside hundreds of other players, seeing who bails at 1.5× and who's still riding at 8×, creates a collective tension that slots and table games rarely match. The live chat amplifies this: players celebrate big wins, mourn crashes, and egg each other on in real time.

**Speed.** Rounds last 5–60 seconds. The dopamine cycle — bet, anticipation, resolution — completes in under a minute. This is faster than almost any other casino game. More rounds per hour means more emotional peaks per hour.

**The crypto-native aesthetic.** The rising multiplier line looks exactly like a cryptocurrency price chart. For a generation raised on watching Bitcoin's value spike and crash, the crash game format feels familiar, almost nostalgic. It's a game that mirrors the emotional experience of speculative trading.

**Low barriers.** No rules to learn, no strategy to study, no cards to count, no table etiquette to navigate. Place your bet. Watch the number go up. Click the button. Anyone can play within five seconds of seeing the game.

### The Legal Battles

Success breeds imitation and litigation. By 2024, the crash game space had become contentious enough to produce real legal drama.

A Georgian company called **Aviator LLC** — not affiliated with Spribe — claimed ownership of the Aviator brand name and sued Flutter Entertainment (one of the world's largest gambling operators) for offering Spribe's version. In August 2024, Aviator LLC claimed it had been awarded **€330 million in damages** from Flutter — coincidentally the same amount Flutter reportedly paid to acquire Adjarabet, the Georgian operator founded by Aviator LLC's owner.

Spribe contested the claims in Georgian courts. The dispute highlights the enormous financial stakes now attached to the crash game format.

### Where It Stands Today (2026)

Crash games represent approximately 1.1% of European iCasino gross gaming revenue — a figure that understates their cultural impact and growth trajectory. New entrants continue to iterate: **Aviatrix** offers NFT-based customizable aircraft, Evolution adapted crash mechanics into its live game show format with **Cash or Crash**, and every major game provider now offers at least one crash title.

But the fundamental game — the game Eric Springer built on the Bitcointalk forum in 2014 — remains unchanged. A number goes up. At some point it stops. Your only decision is when to get out.

It's the simplest game in any casino. And twelve years after its invention, it's one of the most popular gambling formats on Earth.

---

## The Name

*Flameout* derives from the aviation term: the failure of a jet engine's combustion, causing sudden loss of thrust. In a crash game, the multiplier is the engine — it climbs, it roars, and at some unpredictable moment, it flames out. The player's only decision is when to bail.

---

## License

MIT — see [LICENSE](LICENSE).

---

*Flameout is part of the Metaincognita casino simulator suite: educational tools for understanding the mathematics of casino games. No real money. No gambling promotion. Just math, probability, and the eternal human impulse to push the button one more time.*
