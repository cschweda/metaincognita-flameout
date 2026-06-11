<script setup lang="ts">
useSeoMeta({
  title: 'Learn — The Mathematics of Crash Games | Flameout',
  description: 'How crash games work: the inverse distribution, the EV-invariance proof, why betting systems fail, provably fair cryptography, and the history from MoneyPot to Aviator.'
})

const sections = [
  { id: 'what-is', label: 'What is a crash game?' },
  { id: 'distribution', label: 'The distribution' },
  { id: 'generation', label: 'Generating crash points' },
  { id: 'ev', label: 'The EV proof' },
  { id: 'variance', label: 'Variance' },
  { id: 'fallacy', label: 'The gambler\'s fallacy' },
  { id: 'systems', label: 'Betting systems' },
  { id: 'context', label: 'House edge in context' },
  { id: 'provably-fair', label: 'Provably fair' },
  { id: 'history', label: 'History' }
]

const probabilityRows = [
  { target: '1.01×', probability: '96.04%', odds: '~24:1 on' },
  { target: '1.10×', probability: '88.18%', odds: '~7.4:1 on' },
  { target: '1.50×', probability: '64.67%', odds: '~1.8:1 on' },
  { target: '2.00×', probability: '48.50%', odds: '~1.06:1 against' },
  { target: '3.00×', probability: '32.33%', odds: '~2.1:1 against' },
  { target: '5.00×', probability: '19.40%', odds: '~4.2:1 against' },
  { target: '10.00×', probability: '9.70%', odds: '~9.3:1 against' },
  { target: '20.00×', probability: '4.85%', odds: '~19.6:1 against' },
  { target: '100.00×', probability: '0.97%', odds: '~102:1 against' },
  { target: '1,000.00×', probability: '0.097%', odds: '~1,030:1 against' }
]

const houseEdgeRows = [
  { game: 'Blackjack (basic strategy)', edge: '0.5%' },
  { game: 'Crash (99% RTP)', edge: '1.0%', highlight: true },
  { game: 'Craps (Pass Line)', edge: '1.41%' },
  { game: 'European Roulette', edge: '2.70%' },
  { game: 'Crash (97% RTP, e.g. Aviator)', edge: '3.0%', highlight: true },
  { game: 'Crash (95% RTP)', edge: '5.0%', highlight: true },
  { game: 'American Roulette', edge: '5.26%' },
  { game: 'Slots (average)', edge: '2–10%' }
]

const historyEvents = [
  { year: '2014', title: 'MoneyPot', body: 'Eric Springer launches the first crash game on the Bitcointalk forum — a bare line chart inspired by crypto volatility. 250,000 plays in two months. It introduces the social shared-round format and the provably fair hash chain.' },
  { year: '2015', title: 'Bustabit', body: 'Ryan Havar buys and rebrands MoneyPot. Later under Daniel Evans, Bustabit adds investor-funded bankrolls and user-scripted betting bots — attracting amateur quants who optimize strategies against a 1% edge (and still lose).' },
  { year: '2015–17', title: 'CS:GO skin gambling', body: 'Crash spreads through Counter-Strike skin gambling sites, reaching millions of gamers and cementing "crash" as the genre name before regulators shut the ecosystem down.' },
  { year: '2018–19', title: 'Spribe\'s Aviator', body: 'A Kyiv studio rebuilds the format with a little red plane and mobile-first engineering that runs smoothly on cheap phones over 3G — unlocking Africa, Brazil, India, and Southeast Asia.' },
  { year: '2020–25', title: 'The explosion', body: 'Aviator reaches 77 million monthly players across 2,000+ operators, processing an estimated €160 billion in wagers in 2025 — one of the largest single-game volumes in casino history. In Brazil it becomes "jogo do aviãozinho," searched by name before players even pick a casino.' },
  { year: 'Today', title: 'Same game', body: 'NFT planes, live game-show spinoffs, lawsuits over the brand — but the game underneath is unchanged from 2014: a number goes up, at some point it stops, and your only decision is when to get out.' }
]
</script>

<template>
  <div class="flex-1 bg-neutral-950 overflow-y-auto">
    <div class="max-w-3xl mx-auto px-4 py-10 space-y-12">
      <!-- Hero -->
      <header class="space-y-4">
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">
          <span class="text-amber-400">The Mathematics</span>
          <span class="text-neutral-300"> of Crash Games</span>
        </h1>
        <p class="text-neutral-400 text-sm leading-relaxed">
          Crash games have one of the most transparent probability structures in all of
          casino gaming — simple enough to verify yourself, elegant enough to teach real
          lessons about expected value, variance, and the illusion of control. This page
          walks through the whole model. Every claim here can be verified empirically in
          the <NuxtLink
            to="/"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >simulator</NuxtLink> and the
          <NuxtLink
            to="/analysis#strategy-lab"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >Strategy Lab</NuxtLink>.
        </p>
        <nav
          class="flex flex-wrap gap-1.5"
          aria-label="Page sections"
        >
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="px-2.5 py-1 rounded-full text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-amber-400 hover:border-neutral-700 transition-colors"
          >
            {{ section.label }}
          </a>
        </nav>
      </header>

      <!-- What is a crash game -->
      <section
        id="what-is"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          What is a crash game?
        </h2>
        <p class="text-neutral-400 text-sm leading-relaxed">
          A crash game is a multiplier-based gambling format with four moving parts:
        </p>
        <ol class="list-decimal list-inside space-y-1.5 text-sm text-neutral-400">
          <li>A multiplier starts at 1.00× and rises continuously in real time</li>
          <li>At a random, predetermined point, the game "crashes" and the multiplier freezes</li>
          <li>You must press cash-out <em>before</em> the crash to win bet × multiplier</li>
          <li>If the crash comes first, the entire bet is lost</li>
        </ol>
        <p class="text-neutral-400 text-sm leading-relaxed">
          Rounds last 5–60 seconds; real implementations run 80–120 rounds per hour. The
          format feels like a skill game — you chose when to bail! — but as the math below
          shows, the choice of cash-out point has <strong class="text-neutral-300">zero effect on expected value</strong>.
          That tension between feeling and fact is the entire psychology of the genre.
        </p>
      </section>

      <!-- Distribution -->
      <section
        id="distribution"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          The crash point distribution
        </h2>
        <p class="text-neutral-400 text-sm leading-relaxed">
          The crash point is drawn from an inverse distribution. For a game with house edge
          <span class="font-mono text-amber-400">h</span> (say 0.03 for 3%), the return to player is
          <span class="font-mono text-amber-400">r = 1 − h</span>, and:
        </p>
        <pre class="rounded-lg bg-neutral-900 border border-neutral-800 p-4 text-sm font-mono text-amber-300 overflow-x-auto">P(multiplier ≥ m) = r / m</pre>
        <p class="text-neutral-400 text-sm leading-relaxed">
          That's the whole model. The probability of reaching any multiplier is the RTP
          divided by that multiplier. For a 97% RTP game:
        </p>
        <div class="rounded-xl border border-neutral-800 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-neutral-900/80">
              <tr class="text-neutral-500 text-xs uppercase tracking-wider">
                <th class="px-4 py-2 text-left">
                  Target
                </th>
                <th class="px-4 py-2 text-right">
                  Probability
                </th>
                <th class="px-4 py-2 text-right">
                  Implied Odds
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800/50">
              <tr
                v-for="row in probabilityRows"
                :key="row.target"
                class="hover:bg-neutral-900/40"
              >
                <td class="px-4 py-1.5 font-mono text-neutral-300">
                  {{ row.target }}
                </td>
                <td class="px-4 py-1.5 font-mono text-right text-amber-400">
                  {{ row.probability }}
                </td>
                <td class="px-4 py-1.5 font-mono text-right text-neutral-500">
                  {{ row.odds }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-neutral-500 text-xs leading-relaxed">
          Note the crossover at 2.00×: the probability is just <em>below</em> 50%. "Double or
          nothing" in a crash game is slightly worse than a coin flip — that sliver is the
          house edge.
        </p>
      </section>

      <!-- Generation -->
      <section
        id="generation"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          Generating crash points
        </h2>
        <p class="text-neutral-400 text-sm leading-relaxed">
          To generate a crash point from a uniform random number
          <span class="font-mono text-amber-400">R ∈ [0, 1)</span>:
        </p>
        <pre class="rounded-lg bg-neutral-900 border border-neutral-800 p-4 text-sm font-mono text-amber-300 overflow-x-auto">crashPoint = floor(100 × r / (1 − R)) / 100</pre>
        <p class="text-neutral-400 text-sm leading-relaxed">
          When <span class="font-mono">R</span> is near 0, the round crashes almost instantly;
          when <span class="font-mono">R</span> is near 1, the crash point shoots toward infinity.
        </p>
        <div class="rounded-lg bg-red-950/30 border border-red-900/40 p-4 space-y-1.5">
          <p class="text-sm font-semibold text-red-400">
            Instant crashes are the entire house edge
          </p>
          <p class="text-neutral-400 text-sm leading-relaxed">
            A fixed share of rounds crash at exactly 1.00× — everyone loses, no matter what.
            The frequency of these instant crashes equals the house edge: a 3% edge means ~3%
            of rounds are unwinnable. This is the <em>sole</em> mechanism by which the casino
            takes its cut. Remove instant crashes and the game would return exactly 100%.
          </p>
        </div>
      </section>

      <!-- EV proof -->
      <section
        id="ev"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          The proof: every cash-out target has the same EV
        </h2>
        <p class="text-neutral-400 text-sm leading-relaxed">
          This is the central lesson of Flameout. Take a $1 bet at RTP
          <span class="font-mono text-amber-400">r</span>, cashing out at multiplier
          <span class="font-mono text-amber-400">m</span>:
        </p>
        <pre class="rounded-lg bg-neutral-900 border border-neutral-800 p-4 text-sm font-mono text-amber-300 overflow-x-auto">EV = P(win) × payout − P(lose) × bet
   = (r/m) × m − (1 − r/m) × 1
   = r − 1 + r/m − r/m
   = r − 1</pre>
        <p class="text-neutral-400 text-sm leading-relaxed">
          The multiplier <span class="font-mono">m</span> cancels out completely. At 97% RTP
          the expected value is −$0.03 per dollar wagered whether you cash out at 1.10× or
          500×. Which means:
        </p>
        <ul class="list-disc list-inside space-y-1.5 text-sm text-neutral-400">
          <li>There is <strong class="text-neutral-300">no optimal cash-out target</strong></li>
          <li>Conservative and aggressive strategies produce the <strong class="text-neutral-300">same long-run loss rate</strong></li>
          <li>The only thing your target controls is <strong class="text-neutral-300">variance</strong> — how wild the ride is</li>
          <li>Over thousands of rounds, every approach converges to the same house edge</li>
        </ul>
        <p class="text-neutral-400 text-sm leading-relaxed">
          Crash games are "strategy-proof." The game is entirely about risk tolerance,
          bankroll management, and the psychological illusion of control.
        </p>
      </section>

      <!-- Variance -->
      <section
        id="variance"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          Same EV, wildly different rides
        </h2>
        <p class="text-neutral-400 text-sm leading-relaxed">
          EV is invariant; variance is not. The standard deviation of per-round returns grows
          dramatically with the target:
        </p>
        <div class="grid sm:grid-cols-2 gap-3">
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4">
            <p class="font-mono text-emerald-400 text-sm font-bold">
              1.10× target
            </p>
            <p class="text-neutral-500 text-xs mt-1 leading-relaxed">
              Win ~88% of rounds, gaining 10% each time. Feels safe; bankroll grinds down
              slowly and steadily.
            </p>
          </div>
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4">
            <p class="font-mono text-yellow-400 text-sm font-bold">
              2.00× target
            </p>
            <p class="text-neutral-500 text-xs mt-1 leading-relaxed">
              Win ~48.5% of rounds, doubling each time. A coin flip with a slight house lean.
            </p>
          </div>
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4">
            <p class="font-mono text-orange-400 text-sm font-bold">
              10× target
            </p>
            <p class="text-neutral-500 text-xs mt-1 leading-relaxed">
              Win ~9.7% of rounds at 10× the bet. Long losing streaks are routine, not unlucky.
            </p>
          </div>
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4">
            <p class="font-mono text-red-400 text-sm font-bold">
              100× target
            </p>
            <p class="text-neutral-500 text-xs mt-1 leading-relaxed">
              Win ~0.97% of rounds. You might see 200 straight losses before one massive hit.
            </p>
          </div>
        </div>
        <p class="text-neutral-500 text-xs leading-relaxed">
          All four lose 3¢ per dollar in the long run. Pick your poison — that's the only
          choice the game actually offers.
        </p>
      </section>

      <!-- Gambler's fallacy -->
      <section
        id="fallacy"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          The gambler's fallacy
        </h2>
        <p class="text-neutral-400 text-sm leading-relaxed">
          Crash games are unusually good at triggering the gambler's fallacy because the
          round history is displayed prominently. After five straight crashes below 2×, a
          big one <em>feels</em> due. It is not. Every round is an independent draw: the
          probability that the next round reaches 10× is exactly 9.7% (at 97% RTP) whether
          the last 5, 50, or 500 rounds were low or high.
        </p>
        <p class="text-neutral-400 text-sm leading-relaxed">
          The history strip exists for the same reason it exists in real crash games — it
          generates false pattern-recognition. Flameout shows it to you <em>and</em> shows you
          the conditional probabilities in the stats sidebar proving the patterns are noise.
        </p>
      </section>

      <!-- Betting systems -->
      <section
        id="systems"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          Betting systems don't work
        </h2>
        <p class="text-neutral-400 text-sm leading-relaxed">
          Martingale (double after every loss) is the most popular crash-game system. It does
          not change the expected value — it changes the <em>distribution</em> of outcomes:
          many small winning sessions punctuated by catastrophic wipeouts when a losing
          streak outruns the bankroll. D'Alembert, Fibonacci, and Paroli are gentler or
          spikier flavors of the same non-solution.
        </p>
        <p class="text-neutral-400 text-sm leading-relaxed">
          You don't have to take this on faith. The Strategy Lab runs all five systems
          against the <em>identical</em> crash sequence — 100,000 rounds in well under a second —
          and shows every one of them converging to the same expected loss.
        </p>
        <NuxtLink
          to="/analysis#strategy-lab"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm transition-all active:scale-[0.98]"
        >
          <UIcon
            name="i-lucide-flask-conical"
            class="w-4 h-4"
          />
          Open the Strategy Lab
        </NuxtLink>
      </section>

      <!-- House edge context -->
      <section
        id="context"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          House edge in context
        </h2>
        <div class="rounded-xl border border-neutral-800 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-neutral-900/80">
              <tr class="text-neutral-500 text-xs uppercase tracking-wider">
                <th class="px-4 py-2 text-left">
                  Game
                </th>
                <th class="px-4 py-2 text-right">
                  Typical House Edge
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800/50">
              <tr
                v-for="row in houseEdgeRows"
                :key="row.game"
                class="hover:bg-neutral-900/40"
              >
                <td
                  class="px-4 py-1.5"
                  :class="row.highlight ? 'text-amber-400' : 'text-neutral-400'"
                >
                  {{ row.game }}
                </td>
                <td class="px-4 py-1.5 font-mono text-right text-neutral-300">
                  {{ row.edge }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-neutral-400 text-sm leading-relaxed">
          A 99% RTP crash game has one of the lowest edges in any casino — but edge is only
          half the cost equation. The other half is <strong class="text-neutral-300">velocity</strong>:
          at 100+ rounds per hour and $10 bets, a 3% edge costs about
          <span class="font-mono text-red-400">$30/hour</span> in expected losses. Slow games
          with bigger edges can cost less per hour than fast games with small ones.
        </p>
      </section>

      <!-- Provably fair -->
      <section
        id="provably-fair"
        class="space-y-3 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          Provably fair: cryptography instead of trust
        </h2>
        <p class="text-neutral-400 text-sm leading-relaxed">
          Crash games pioneered "provably fair" gambling — using hash commitments so players
          can verify every outcome was predetermined and unmanipulated, with no trust in the
          casino or its auditors required. It rests on one property of cryptographic hashes
          like SHA-256: computing a hash is instant, reversing one is computationally
          infeasible, and changing a single input bit changes the whole output.
        </p>
        <div class="space-y-3">
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4 space-y-1.5">
            <p class="text-sm font-semibold text-neutral-300">
              1 — The hash chain commits to every outcome in advance
            </p>
            <p class="text-neutral-500 text-xs leading-relaxed">
              Before any game is played, the casino picks a random seed and hashes it
              millions of times: <span class="font-mono">seed₁ = SHA-256(seed₀)</span>, and so
              on. Games are then played in <em>reverse</em> chain order. Revealing game N's
              seed lets you verify it hashes to the previously published value — and
              simultaneously commits the casino to game N+1. The whole future was locked in
              before round one.
            </p>
          </div>
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4 space-y-1.5">
            <p class="text-sm font-semibold text-neutral-300">
              2 — A client seed prevents cherry-picked chains
            </p>
            <p class="text-neutral-500 text-xs leading-relaxed">
              Outcomes are derived from <span class="font-mono">HMAC-SHA256(server_seed, client_seed)</span>,
              where the client seed is something the casino couldn't predict when it built
              the chain — a future Bitcoin block hash, a public randomness beacon, or
              player-supplied entropy. The casino chose its seeds, but not what they map to.
            </p>
          </div>
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4 space-y-1.5">
            <p class="text-sm font-semibold text-neutral-300">
              3 — The hash becomes a crash point deterministically
            </p>
            <pre class="rounded bg-neutral-950 border border-neutral-800 p-3 text-[11px] font-mono text-amber-300 overflow-x-auto mt-1">H = first 52 bits of the hash
if H % 101 === 0 → crash at 1.00×   // ~0.99% instant crashes = ~1% edge
else → crashPoint = floor((100 × 2⁵² − H) / (2⁵² − H)) / 100</pre>
            <p class="text-neutral-500 text-xs leading-relaxed">
              The divisibility check elegantly enforces the exact house edge: precisely 1 in
              101 uniformly distributed values triggers an instant crash. Bustabit uses this
              exact construction.
            </p>
          </div>
          <div class="rounded-lg bg-neutral-900/60 border border-neutral-800 p-4 space-y-1.5">
            <p class="text-sm font-semibold text-neutral-300">
              4 — Anyone can verify, nobody needs trust
            </p>
            <p class="text-neutral-500 text-xs leading-relaxed">
              After each round the casino reveals the server seed. You check that it hashes
              to the prior commitment and that the published crash point follows from the
              formula. The same primitives — commitment schemes, hash chains, HMAC — secure
              sealed-bid auctions, certificate transparency, Git, and JWT tokens. A crash
              game is the most accessible demo of them in the wild.
            </p>
          </div>
        </div>
        <p class="text-neutral-500 text-xs leading-relaxed">
          <strong class="text-neutral-400">Limits:</strong> provable fairness guarantees outcomes weren't
          manipulated <em>after commitment</em>. It can't prove the initial seed was truly random,
          that the implementation is bug-free, or that the operator won't vanish. And Flameout
          itself doesn't implement it — no real money is at stake here, so it would be security
          theater. We use <span class="font-mono">Math.random()</span> live and a seeded PRNG
          (mulberry32) for reproducible simulations, and teach the real system instead.
        </p>
      </section>

      <!-- History -->
      <section
        id="history"
        class="space-y-4 scroll-mt-16"
      >
        <h2 class="text-xl font-bold text-neutral-200">
          A brief history
        </h2>
        <div class="space-y-3">
          <div
            v-for="event in historyEvents"
            :key="event.year"
            class="flex gap-4"
          >
            <div class="shrink-0 w-16 text-right">
              <span class="font-mono text-amber-400 text-sm font-bold">{{ event.year }}</span>
            </div>
            <div class="border-l border-neutral-800 pl-4 pb-1 space-y-1">
              <p class="text-sm font-semibold text-neutral-300">
                {{ event.title }}
              </p>
              <p class="text-neutral-500 text-xs leading-relaxed">
                {{ event.body }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <footer class="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-6 text-center space-y-3">
        <p class="text-neutral-300 font-semibold">
          Now watch all of it happen in real time.
        </p>
        <p class="text-neutral-500 text-xs">
          Simulated bankroll, configurable house edge, live distribution tracking.
          No real money — just the math.
        </p>
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-base transition-all active:scale-[0.98]"
        >
          <UIcon
            name="i-lucide-flame"
            class="w-5 h-5"
          />
          Launch the simulator
        </NuxtLink>
      </footer>
    </div>
  </div>
</template>
