# Deployment and recovery

## Canonical source and hosting

All application source, tests and migrations belong to `Tingbing/Cuyoo`, branch `codex/gameplay-animations-replacements` (merged to `main` after validation). Sites uses a deployment-source mirror to publish the same source. This is a standalone application with a dedicated D1 database; it has no connection to the Wiffle Ball app or its Supabase project. No paid plans or purchases were enabled.

Use Node 22.13+ and the version of pnpm pinned in package.json. `bash scripts/install-pnpm.sh` installs dependencies with the frozen lockfile. `npm run test`, `npm run typecheck`, `npm run build` perform the supported checks. Production builds use the supplied Sites/Vinext integration. The UI and API share one origin; no CORS or secret environment variables are needed.

`.openai/hosting.json` contains the Site identity and logical `DB` D1 binding. Sites provisions the dedicated binding and applies the versioned `drizzle/` migrations before uploading the Worker. Runtime schema creation is prohibited. For standalone Cloudflare use, bind your own free-plan D1 database to `DB` and configure its real database ID in Wrangler; the starter ID is only for local emulation, never a live database target.

## Local D1 and verification

1. Install, then generate changes with `npm run db:generate` after editing `db/schema.ts`.
2. Build once. Apply pending SQL in order using the starter’s command:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_flawless_havok.sql
```

3. Never replay an already applied migration. SQL, snapshots and journal entries are immutable after deployment.
4. `npm run test` runs independent rules fixtures and real Miniflare/Workers D1 integration tests. Integration uses synthetic anonymous sessions and a temporary persistent D1 store; only test timestamps are advanced through the administrator D1 binding. No such clock-advance endpoint exists in production.
5. `tests/https-check.mjs <URL>` runs independent device sessions against the deployed backend without privileged access. Synthetic table names identify the test. The script intentionally uses actual server transition times and must heartbeat every participant.

6. Use the existing Chromium executable with `CUYOO_CHROMIUM=/path/to/chromium npm run test:browser` after building. The v2 runner creates four/six independent contexts plus fresh replacement devices on the isolated local HTTPS Worker/D1 backend and writes aggregate evidence to `outputs/new-browser/`. Only inspected public completed-count screenshots/results are committed. It accepts its local test certificate only and removes synthetic D1 after completion. `tests/browser-check.mjs` is a compatibility entry point to this runner. `tests/lobby-browser-check.mjs` remains a separately invoked live waiting-lobby smoke check; it never selects other groups' rooms.

Browser UI coverage is a separate requirement from API sessions. Neither pure rules tests nor independent API sessions claim to be independent browser contexts or proof of mobile animation performance.

## State and consistency

`rooms.state` is a private JSON record. Every accepted mutation compares the prior version. A D1 transactional batch combines room membership with `sessions.active_room`; simultaneous joins cannot overfill rooms or give one device two seats. Action UUID receipts reconcile lost responses. Replay with different content fails. Stale versions/hand IDs fail recoverably with HTTP 409.

HttpOnly Secure SameSite=Lax cookie contains a 256-bit random device credential; only its SHA-256 hash is stored. APIs never return it, seat identity hashes, the undealt deck, or other hands. The host has no extra hand access. Origin checks and JSON-only POSTs prevent cross-origin move submission. Session action limits: 180/minute; room cap 80; at most 8 recent host-owned tables/hour. Names use text rendering. No SQL injection via user-supplied fields; every value is bound.

A controller lease makes simultaneous tabs read-only. A separate WebSocket presence connection renews presence every two seconds even when a browser's polling timers are throttled. Each connection has its own durable lease in the additive `connections` table. Last-socket closure records observed loss; stalled heartbeat detection takes six seconds, then the exact persisted reconnect deadline reserves the occupant for ten seconds. D1 reconciliation atomically releases due occupants, updates membership, and transfers host. A request arriving at/after expiry reconciles BEFORE renewal, so an old occupant cannot revive a replaced seat.

Server timestamps control shuffle/deal/collection and result-review expiry. The CURRENT host sets one review deadline at serverNow+5000ms. Requests and server connection loops reconcile due phases with compare-and-swap; no animation acknowledgment or host browser is required. If every connection disappears, playable progress is blocked by vacancies, while review expiry remains a persisted gate. On the next connection/request after restart, reconciliation completes due work idempotently. A late request never invents an earlier deadline or repeats scoring.

All seats remain fixed, including empty waiting seats. Occupancy epochs invalidate stale UI actions. Current cookie membership is checked on every private view/mutation. Replacement transfers no session credentials: the new session receives its own authorized projection of the preserved seat. Historical accepted card events and trick entries retain the playing occupant's name.

Rooms retain the original policy: unattended waiting tables expire after 24 hours, other abandoned games after seven days, with connected members protecting retention. Lobby metadata reveals only occupancy and names, never protected cards. Connection rows older than their lease plus a minute are cleaned when a socket opens.

## Version 2 upgrade and ordering

Apply immutable additive migration `0001_occupancy_review_v2.sql` once BEFORE deploying the new Worker. It creates `connections` and its index, adds private `rooms.pre_v2_state`, and copies each existing room state into that column before upgrade. It does not modify the current game state or session rows, and deletes no games. Backups remain private in the dedicated database under the ordinary room-retention policy. Existing JSON rooms are decoded/upgraded inside the same optimistic transaction as reconciliation. Stable seat indices, hands, deck, scores and historical results are preserved. Existing count results stop auto-advancing and gain a fresh review ID WITHOUT scoring again. An already-dealing old hand gains a timed packet projection. An old six-player second suit-selection phase returns to a complete proposed-suit auction from dealer's left; no hand is reset. All new auctions use the confirmed rules. Historical automatic-trump hands are not recalculated.

For final QA, build then run `CUYOO_CHROMIUM=/path/to/chromium npm run test:browser`. This launches the ACTUAL compiled Worker and assets on local HTTPS with shared isolated D1 and fresh cookie-isolated Chromium contexts. Only that local self-signed test certificate is accepted by the test contexts. No production TLS bypass or administrative clock endpoint exists. The backend fixture applies migrations to its disposable synthetic store, exercises real deadlines, and destroys the store after completion. This is an HTTPS local QA preview, not a publicly hosted staging deployment. Prior v1 browser results/scripts are historical evidence and are not proof of current behavior.

## Publish, rollback and resume

Publish only built, checked source through Sites’ source workflow and retain the exact pushed SHA/archive/version IDs. Check terminal deployment status. The friend-play audience is public by explicit requirements (no account wall); anonymous game access still enforces seat privacy.

Rollback only to a saved version compatible with schemaVersion 2. The old v1 Worker does not understand vacant active seats and MUST NOT be deployed over upgraded running matches. The additive SQL can remain during a forward fix; preserve its journal and use a version-2-aware worker. A source snapshot from before upgrade is available in the previous Site version, but is not a safe runtime rollback after upgraded games exist. Do not revert applied migrations or restore an older JSON snapshot over a newer running match. The first schema migration is additive and immutable. Before a future incompatible state change, add a migration/versioned decoder and drain active games or preserve backward-compatible read/write paths. D1 backup/export is an administrative recovery action; keep its private state out of public source control.

When resuming, read `IMPLEMENTATION_PROGRESS.md`, fetch the current GitHub default and implementation branches, inspect `.openai/hosting.json` and current Site/version status. Preserve existing deployment identity and audience. Do not create a second Site or reuse an unrelated backend.
