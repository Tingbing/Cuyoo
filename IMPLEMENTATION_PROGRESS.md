# Cuyoo implementation checkpoint

Target: Tingbing/Cuyoo; branch codex/cuyoo-multiplayer. Original repository was empty. Main received only an initialization README so GitHub could create an isolated branch.

Architecture: Vinext/React on Sites Cloudflare Workers; dedicated D1 binding DB. Server-owned JSON state with atomic version compare-and-swap, transactional room/session membership, cryptographic Fisher-Yates and random dealer, durable action receipts, restart-safe timestamp transitions recovered by the next request. HTTP polling every 700ms in play / 2s in lobby; clients never set scores, decks, or other hands. HttpOnly secure anonymous cookie, hashed at rest, per-device tab controller lease. No Supabase or Wiffle data used.

Implemented: core card rules, cut/deal, two trump rounds, legal plays, trick collection, score/tie/caller penalty, next dealer, rematch, whitelist private views, session/room API, lobby lifecycle. Responsive React UI, room lobby, cut slider, turn controls, hand/score/count/history/rematch presentation and motion preferences are implemented.

Unconfirmed defaults: six-player all-pass round two redeals with same dealer, no score; repeated ties retain exactly one bonus.

Validation completed: 12 rules fixtures and 4 D1 integration subtests (17 Node test entries total) pass. Real local Workers/D1 runtime completed four- and six-device-session matches, rematches, atomic overfill race, private whitelist projections, host transfer, cross-origin rejection, stale/duplicated actions and tab leases. Synthetic-only D1 transition timestamps are accelerated in integration tests. TypeScript and production build passed. Focused lint corrected during final verification.

Status: implemented and locally backend-tested, not yet declared ready. Remaining: final checks after retry/duplicate-tab fixes, live HTTPS backend matches, GitHub implementation commit/PR, actual independent browser-session checks. Managed preview lacks control-browser; installed Playwright has no Chromium executable. Browser animation/mobile claims remain unverified until a supported browser can inspect them. Sites project identity is persisted in .openai/hosting.json. Audience is public as required for username-only friend play. No live success claimed yet.


## Published test build and review

GitHub PR: https://github.com/Tingbing/Cuyoo/pull/1 (draft). Initial implementation commit: 99f7983afb6664fcece5c05127ed69c2fd2be0c5. Main remains the initialization README; no release process existed.

HTTPS URL: https://cuyoo-table.warm-ghost-4468.chatgpt.site. Version 1 deployed successfully; deployment appgdep_6acafa4fe54081919d66a7c942c2b5f8, source mirror commit d29f991c54f7b84b6b2e33074ac5e27e4f32b487. Dedicated DB migrations applied by hosting. The Site is public for username-only friend access.

Desktop cloud-browser inspection succeeded: live lobby, create, seats/teams, manual disabled start, reload restoration, second-tab read-only enforcement and leave flow. Screenshot and exact limitations: docs/VALIDATION.md. Required 4/6 independent browser contexts and mobile animation checks remain outstanding; no claim of complete browser validation.

Latest fixes: an emptied waiting room gives the next joining participant host ownership; independent HTTPS-test cookie jars retain gateway/device cookies separately; integration driver consistently chooses one calling team to prevent artificially long random penalty walks. The full local integration suite passes after the fixes. Build passes. Live HTTPS complete-match checks remain running.

Final review also prevents a rematch after a player leaves: completed-match departures retain fixed team positions, and rematches require every original seat connected. A new independent regression fixture verifies this. Heartbeats now renew at most once per five seconds to reduce background database writes.

Live four-player HTTPS result: 11 hands, 176 card plays, elapsed 393 seconds including all network assertions; final score 7 to -1; rematch reset verified. Synthetic room 04d1a94a-3afa-4b8e-a211-aa2a812405e6. Six-player match remains in progress.
