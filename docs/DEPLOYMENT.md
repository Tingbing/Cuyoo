# Deployment and recovery

## Canonical source and hosting

All application source, tests and migrations belong to `Tingbing/Cuyoo`, branch `codex/cuyoo-multiplayer`. Sites uses a deployment-source mirror to publish the same source. This is a standalone application with a dedicated D1 database; it has no connection to the Wiffle Ball app or its Supabase project. No paid plans or purchases were enabled.

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

6. `pnpm exec playwright install chromium` installs the browser required for `CUYOO_URL=https://your-isolated-test-site npm run test:browser`. The runner creates four and six separate cookie-isolated contexts and drives real UI actions through complete matches. It writes only synthetic screenshots and aggregate results under `docs/browser-evidence/`; it does not serialize cookies or private network snapshots. Optional `CUYOO_CHROMIUM` selects an existing Chromium executable and `PLAYWRIGHT_MODULE` selects a runtime-supplied Playwright module. In a managed intercepting proxy, `CUYOO_PROXY_INSECURE=1` permits that proxy's certificate in the test browser only. No such bypass is present in app code. `CUYOO_VISUAL_ONLY=1` runs one-hand presentation fixtures; `node tests/lobby-browser-check.mjs` checks waiting host transfer/empty-lobby ownership. Never run on another group's real rooms.

Browser UI coverage is a separate requirement from API sessions. Neither pure rules tests nor independent API sessions claim to be independent browser contexts or proof of mobile animation performance.

## State and consistency

`rooms.state` is a private JSON record. Every accepted mutation compares the prior version. A D1 transactional batch combines room membership with `sessions.active_room`; simultaneous joins cannot overfill rooms or give one device two seats. Action UUID receipts reconcile lost responses. Replay with different content fails. Stale versions/hand IDs fail recoverably with HTTP 409.

HttpOnly Secure SameSite=Lax cookie contains a 256-bit random device credential; only its SHA-256 hash is stored. APIs never return it, seat identity hashes, the undealt deck, or other hands. The host has no extra hand access. Origin checks and JSON-only POSTs prevent cross-origin move submission. Session action limits: 180/minute; room cap 80; at most 8 recent host-owned tables/hour. Names use text rendering. No SQL injection via user-supplied fields; every value is bound.

A controller lease makes simultaneous tabs read-only. It is renewed at most every 5 seconds by successful API requests and expires after 15 seconds without the controlling tab. Connection display expires after 20 seconds. Membership is independent of presence.

Server timestamps control shuffle/deal/collection/count transitions. The first request after a deadline performs the transition with atomic compare-and-swap. If all browsers are closed, presentation pauses in storage and resumes on the next request. Worker restarts require no recovery jobs. No client animation acknowledgement drives results.

Active rooms retain seats; missing actors wait. Abandoned waiting rooms expire after 24 hours, other abandoned rooms after 7 days, only when no member has been seen for two minutes. Lobby visits perform bounded cleanup. Live polling is 700ms in-room, 2 seconds in lobby; there is no unsupported WebSocket dependency. This is intended for small friend groups, not an unbounded public gaming service.

## Publish, rollback and resume

Publish only built, checked source through Sites’ source workflow and retain the exact pushed SHA/archive/version IDs. Check terminal deployment status. The friend-play audience is public by explicit requirements (no account wall); anonymous game access still enforces seat privacy.

Rollback to a previously saved compatible Site version. Do not revert applied migrations or restore an older JSON snapshot over a newer running match. The first schema migration is additive and immutable. Before a future incompatible state change, add a migration/versioned decoder and drain active games or preserve backward-compatible read/write paths. D1 backup/export is an administrative recovery action; keep its private state out of public source control.

When resuming, read `IMPLEMENTATION_PROGRESS.md`, fetch the current GitHub default and implementation branches, inspect `.openai/hosting.json` and current Site/version status. Preserve existing deployment identity and audience. Do not create a second Site or reuse an unrelated backend.
