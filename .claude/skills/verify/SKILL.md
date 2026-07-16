---
name: verify
description: Build/launch/drive recipe for runtime-verifying Flameout changes in a real browser
---

# Verifying Flameout at runtime

## Launch

```bash
./start-dev-server.sh        # kills stale servers, serves http://localhost:3000
```

Wait for `Local: http://localhost:3000/` in the output. Kill afterwards with
`lsof -ti tcp:3000 | xargs kill`.

## Driving with Chrome MCP (claude-in-chrome)

- **Extension synthetic ref-clicks do not trigger Vue handlers on this app.**
  Drive interactions with `javascript_tool` instead:
  `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Start Game')).click()`
  goes through the same DOM listeners a user's click does.
- **The MCP tab is `visibility: hidden`**, so Chrome suspends rAF: the
  multiplier display freezes at its last ticked value while wall-clock time
  flows. This is expected — round outcomes derive from `startedAt`, and
  navigating to `/history` (mounts `resolveInterrupted()`) settles any
  overdue crash/auto-cashout. Use that navigation as the resolution step.
- **Vue watcher flush**: `input` events and a follow-up action in the same
  synchronous JS block race the `watch()` flush (e.g. clearing the bet input
  then dispatching Space sees the OLD `pendingBet`). Split them into separate
  javascript_tool calls with a short wait between.
- `localStorage.getItem('flameout-session')` is blocked by the extension as
  a sensitive key — test for existence/behavior, not contents. Clear state
  with `localStorage.clear(); location.reload()`.

## Flows worth driving

- Setup → Start Game (fresh: straight to `/game`; with saved session: the
  confirm dialog must appear first).
- Place Bet → LIVE: bet input and auto-cashout input must both disable
  (auto-cashout title becomes "Locked while a bet is in flight").
- Set auto-cashout target in WAITING (commits on `change` — dispatch
  `new Event('change', {bubbles: true})` after setting `.value` via the
  native setter), bet, let wall clock pass the target, then visit
  `/history`: the round must record a cashout at exactly the target.
- Space with a cleared bet input must do nothing (ghost-round guard).
- `/analysis`: Run Simulation → 5 curves, then `log y` toggle must reshape
  the polyline points.
- Sweep `read_console_messages` with pattern `error|warn|failed` at the end.
