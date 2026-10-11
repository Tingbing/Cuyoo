# Cuyoo implementation checkpoint

Canonical repository: https://github.com/Tingbing/Cuyoo. Branch: `codex/cuyoo-multiplayer`. PR: https://github.com/Tingbing/Cuyoo/pull/1 (draft pending final browser QA). Original repo was empty; main contains only initialization README commit e018f92bc170aa2f8c7bc26664037327896900a5. No unrelated code or Wiffle/Supabase data was used.

## Implemented

React/Vinext UI and Cloudflare Workers API with dedicated D1 binding `DB`. Server-owned state, cryptographic rejection-sampled Fisher–Yates and random dealer, atomic state-version compare-and-swap, transactional room/session membership, durable action receipts, and timestamp-driven phases recovered on the next request after restart. Polling: 700ms in-room, 2s lobby. Browser event playback is bounded to three presentation frames and skips history after a long gap, hidden tab, new room, or reduced-motion preference. Presentation never changes accepted results or supplies action versions.

Secure anonymous device cookie is HttpOnly/Secure/SameSite=Lax, 256-bit random and hashed at rest. Tab-controller lease, bounded action/room creation rates, same-origin JSON POST, whitelist participant views, private deck and other hands excluded. Heartbeats write at most every five seconds. Active seats persist through disconnects without AI replacement. Waiting host transfer is deterministic. Completed departures retain original team positions and prevent incomplete rematches.

Rules: four/six players; alternating fixed teams; 24 unique cards; cutter right of dealer; two-card packets clockwise from dealer's left; four cards each. Four-player eight undealt cards remain private and outside scoring; top proposes and all-pass bottom automatically sets trump without caller. Six-player dealer's last card remains in that hand; second round allows the other three suits. First trick lead left of dealer. Follow lead OR trump, must trump if unable to follow but holding trump, otherwise discard; no bowers/overtrump. Four tricks; captured A4/K3/Q2/J1 points decide each hand. Winner +1 plus pending bonus, losing caller −1, negatives allowed. Dealer rotates after completed/tied hands. Target >=7; rematch clears state and samples initial dealer again. Exact rules: `docs/CUYOO_RULES.md`.

Unconfirmed defaults, isolated in the engine: six-player round-two all-pass redeals with SAME dealer/no score; repeated ties retain ONE bonus without compounding.

## Validation

18 Node test entries pass: 13 independent rule fixtures plus four real Workers/D1 integration subtests and their wrapper. Covers complete 4/6-session matches/rematches, seat/packet/card conservation, legal moves, points rather than tricks, penalties/ties/negatives, privacy, join/start races, action replay/staleness, controller leases, origin rejection, waiting host transfer, and persistent state through Worker recreation. Integration accelerates ONLY synthetic local D1 deadlines; production has no administrative clock API. Latest app typecheck, focused lint and production build pass.

Actual live HTTPS backend checks completed with independent anonymous cookie jars and real server timers:

| Players | Hands | Card plays | Final score | Elapsed incl. network assertions | Rematch |
| --- | ---: | ---: | --- | ---: | --- |
| 4 | 11 | 176 | A 7, B -1 | 393 seconds | Reset verified |
| 6 | 19 | 456 | A 1, B 7 | 965 seconds | Reset verified |

API synthetic room IDs: 04d1a94a-3afa-4b8e-a211-aa2a812405e6 and 2b16933f-86f2-435c-8ff4-29830d69efec. Old abandoned synthetic lobby: eaa59c6d-7273-4338-a911-354e643742ee. They use normal retention; no privileged deletion endpoint was added. No private payloads/cookies are saved in reports.

Actual cloud desktop browser verified lobby/create/seats/teams/incomplete manual start/reload/same-device second-tab read-only/leave. Its single-cookie profile cannot prove independent players. A separate fresh Chromium 153 browser with Playwright 1.62.1 is now running `tests/browser-check.mjs` against the real deployed app using four/six isolated BrowserContexts. Required full UI matches, phone layouts, motion, refreshed roles, count replay, network loss and rematches remain in progress; no readiness claim before passing.

The browser run found a startup race: typing before session bootstrap could be overwritten. Username input is now disabled until bootstrap completes. Further browser findings will be recorded in `docs/VALIDATION.md` and aggregate secret-free evidence under `docs/browser-evidence/`.

## Hosting and review

Working HTTPS: https://cuyoo-table.warm-ghost-4468.chatgpt.site/ (public by username-only friend-play requirements). Dedicated D1 migrations are deployed. Latest current version 5: appgprj_6acaf74b5fcc8191903fb83f348ad81d~appgver_cd89a596e6ac8191bcc29e519c16a511; deployment appgdep_6acb085b1cb481918e5d13d37336538e succeeded; source mirror commit 30089724334a574de7b0e1d8398cb3fbd35159d9. Site project identity: `.openai/hosting.json`; preserve it. No paid upgrades were enabled. Canonical GitHub head currently dcfb6c699804f2fcaa83474d9689e6acd77f0405; final event/card/browser-test updates await the next isolated implementation commit. Do not merge main during QA.

Read `docs/DEPLOYMENT.md` for installation, local database migrations, browser runner, publication, rollback and restart recovery. Remaining: finish independent-browser checks/fixes, retain evidence, final GitHub commit/PR update and matching Site source publication, recheck repository and backend targets, and deliver verified links and concise playing instructions.
