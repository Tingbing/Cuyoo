# Cuyoo implementation checkpoint

Canonical repository: https://github.com/Tingbing/Cuyoo. Branch: `codex/cuyoo-multiplayer`. PR: https://github.com/Tingbing/Cuyoo/pull/1 (validated; final review-ready update accompanies this checkpoint). Original repo was empty; main contains only initialization README commit e018f92bc170aa2f8c7bc26664037327896900a5. No unrelated code or Wiffle/Supabase data was used.

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

Actual independent browser QA is complete. Fresh Playwright 1.62.1 / Chromium 153.0.8010.0 cookie-isolated contexts completed both modes on the real HTTPS backend:

| Browser players | Hands | UI card plays | Final score | Seconds incl. outages/retries | Rematch |
| --- | ---: | ---: | --- | ---: | --- |
| 4 | 10 | 160 | A -4, B 7 | 587 | Reset, dealer 0 then 2 |
| 6 | 13 | 312 | A -1, B 7 | 1014 | Reset, dealer 3 then 3 |

Both passed shared lobby/manual host start/full room, distinct cookies, participant-only/private views, same-device viewer tab, cutter-only touch/keyboard slider, exact UI trump/legal plays, consistent scores, refreshed cutter/caller/current/non-current/collect/count, temporary actor and 22-second host offline periods, replay-safe delayed response, all presentation phases, 320/390px overflow and card/label spacing checks, reduced motion and zero uncaught app errors. A fresh random dealer can equal the previous seat. Waiting host transfer and an empty lobby's new host passed in separate real browser sessions; all seats left that test lobby.

Final presentation refinements were verified in additional real four/six-context one-hand browser fixtures. All 16/24 captured cards and actual totals/deltas rendered correctly: 0:24 with no-caller fallback, and 31:9 with a winning caller. Final code uses direction-based card travel, shorter count staggering and subtle win feedback. Source lint/type/build pass. Actual cloud desktop no-account lobby/reload/viewer/leave inspection is supplementary.

Browser findings fixed: name entry is disabled until session bootstrap to avoid overwritten early typing; narrow phone played-card labels/positions no longer overlap; requests have a 10-second timeout, with same-ID retries reconciling accepted actions. Test GET observations are bounded and stale UI-version responses trigger resynchronization. Synthetic fixtures use normal retention; no privileged delete/raw-state endpoint or private-cookie/payload report was added.

Evidence: `docs/VALIDATION.md`, `docs/browser-evidence/results.json`, `docs/browser-evidence/lobby-result.json`, and `docs/visual-final/results.json`. Selected images show finalized public counts/completed matches. No known functional blocker remains. These are actual Chromium viewport/touch checks; physical-phone/Safari/FPS benchmarking was not performed.

## Hosting and review

Working HTTPS: https://cuyoo-table.warm-ghost-4468.chatgpt.site/ (public by username-only friend-play requirements). Dedicated D1 migrations are deployed. Verified runtime version 7: appgprj_6acaf74b5fcc8191903fb83f348ad81d~appgver_de9cd494efcc8191a81a689d6fa526c3; deployment appgdep_6acb0d59ee1881919b9fc6d082361d6f succeeded; source mirror application commit 4d70256968708b78c795e8bc8cca60deb03b0e6b. Final documentation/evidence publication reuses this unchanged checked application bundle. Native live overview reconfirmed project identity and binding DB with only rooms/sessions user tables. Preserve `.openai/hosting.json`; no unrelated backend or paid upgrade was used.

Review: https://github.com/Tingbing/Cuyoo/pull/1. Implementation history includes initial commit 99f7983afb6664fcece5c05127ed69c2fd2be0c5 and f8cbb4275d9db0cafa8cc05140fb19c0c8f264e7; the final evidence/refinement commit accompanies this checkpoint on the same isolated branch. Main remains initialization-only; the implementation has not been merged. Final source, evidence and PR status are verified during handoff.

Read `docs/DEPLOYMENT.md` for installation, immutable database migrations, real backend/browser runners, exact publication ordering and rollback/restart recovery. There are no outstanding implementation or required validation items. The two explicitly labeled house-rule defaults above remain easy to change if the group later confirms alternatives.
