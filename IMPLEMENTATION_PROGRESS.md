# Cuyoo implementation checkpoint

Target: Tingbing/Cuyoo; branch codex/cuyoo-multiplayer. Original repository was empty. Main received only an initialization README so GitHub could create an isolated branch.

Architecture: Vinext/React on Sites Cloudflare Workers; dedicated D1 binding DB. Server-owned JSON state with atomic version compare-and-swap, transactional room/session membership, cryptographic Fisher-Yates and random dealer, durable action receipts, restart-safe timestamp transitions recovered by the next request. HTTP polling every 700ms in play / 2s in lobby; clients never set scores, decks, or other hands. HttpOnly secure anonymous cookie, hashed at rest, per-device tab controller lease. No Supabase or Wiffle data used.

Implemented: core card rules, cut/deal, two trump rounds, legal plays, trick collection, score/tie/caller penalty, next dealer, rematch, whitelist private views, session/room API, lobby lifecycle. Responsive React UI, room lobby, cut slider, turn controls, hand/score/count/history/rematch presentation and motion preferences are implemented.

Unconfirmed defaults: six-player all-pass round two redeals with same dealer, no score; repeated ties retain exactly one bonus.

Validation completed: 12 rules fixtures and 4 D1 integration subtests (17 Node test entries total) pass. Real local Workers/D1 runtime completed four- and six-device-session matches, rematches, atomic overfill race, private whitelist projections, host transfer, cross-origin rejection, stale/duplicated actions and tab leases. Synthetic-only D1 transition timestamps are accelerated in integration tests. TypeScript and production build passed. Focused lint corrected during final verification.

Status: implemented and locally backend-tested, not yet declared ready. Remaining: final checks after retry/duplicate-tab fixes, live HTTPS backend matches, GitHub implementation commit/PR, actual independent browser-session checks. Managed preview lacks control-browser; installed Playwright has no Chromium executable. Browser animation/mobile claims remain unverified until a supported browser can inspect them. Sites project identity is persisted in .openai/hosting.json. Audience is public as required for username-only friend play. No live success claimed yet.
