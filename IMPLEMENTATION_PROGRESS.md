# Cuyoo confirmed-rules update — checkpoint

Canonical source: https://github.com/Tingbing/Cuyoo. Isolated branch: `codex/gameplay-animations-replacements`, based on the existing deployed implementation at `420cdfdd28d6e6aa244ea7b83867e3efd11c39ab`. Main was initialization-only; the existing implementation was in unmerged PR #1. No Wiffle repository or Supabase data was touched.

## Implemented superseding behavior

1. Holding the led suit permits follow OR trump; being void permits ANY owned card, even with trump. Client, gesture controls and independent server validation agree.
2. Four-player second proposal is the NEXT unused card, including the same suit, with a complete ordinary pass/play round. All-pass twice advances dealer and redeals. Six-player all-pass once immediately advances/redeals; no alternative-suit round remains.
3. Shared bonus is constrained to one pending point. Passes/ties do not compound; the next decisive win is two maximum, losing-caller penalty stays one, and six-to-eight is preserved. Passed attempts are separate from scored history.
4. Scoring happens once before durable review. Nonhost dismissal closes only that occupant's panel. Current host sets one authoritative 5000ms deadline; it survives reload/transfer, permits expiry while vacant and never scores again. Final review goes to match complete.
5. Deal uses a persisted ID/start and 2*N clockwise packets at 360ms each after a 600ms synchronization prelude. Private server projection exposes zero/two/four own faces only at actual delivery. Reduced motion and reconnect retain canonical order/current count. Trump is hidden until the deal completes.
6. Local visible hand headings and duplicate backs are removed. Other seats retain backs. Center faces use full opacity/readable suit colors; ALL center trump cards receive a gold outline and winners retain a separate glow. Historical played-card names survive replacement.
7. Pointer drag/swipe, tap, click and Enter invoke one validated action. Upward threshold is 48px–80px (6% viewport), upward movement >1.25*horizontal. Short/sideways/canceled gestures return; pending requests suppress duplicate drag clicks; rejected moves restore through authoritative resync.
8. Persistent device light/dark toggle on home applies before paint and uses system fallback without a saved preference. Tokens cover dialogs, result panels, fields, score/seat badges and notices; private preference does not affect other devices.
9. Leave releases a seat immediately in any phase, revokes reads/actions and preserves game state. Stable seat/team and occupant epoch remain separate. New device atomically claims a vacancy and inherits the SAME remaining hand, actor/obligations, scores, bonus and phase. Vacancies pause gameplay; filling them resumes automatically.
10. WebSocket presence leases observe last-socket closure and detect silent loss after six seconds, then reserve for TEN seconds. Server ping/browser message acknowledgments avoid background interval throttling. Closing one tab preserves another live connection. Reconciliation happens before late renewal; expiry and competing claims are transactional. Host transfer is deterministic and preserves review gates. All-vacant rooms retain normal retention.

## Architecture, migration, compatibility

Existing React/Vinext + Cloudflare Workers/D1 architecture retained. Presence upgrade is routed directly in the existing Worker; it carries only ping/pong, never private cards. Private views are re-authorized per cookie/current occupancy, not cached subscription grants. CAS room versions, match/hand/review IDs, action receipts and membership batches protect duplicate/racing transitions. No new paid infrastructure or global authentication changes.

Additive immutable Drizzle migration `0001_occupancy_review_v2.sql` creates `connections` and its session index, adds private `rooms.pre_v2_state`, and snapshots existing room JSON into that column. The current `rooms.state` and session rows are unchanged; old migration files are immutable. Apply migration BEFORE the new Worker. schemaVersion 2 decoder preserves current allocation, stable seats, scores and historical results; converts old count to durable review without rescoring; an old six-player second auction returns to the proposed suit from dealer's left. Do not roll back to a v1 Worker over upgraded games. See `docs/DEPLOYMENT.md` for recovery.

Verified existing hosted Site: `appgprj_6acaf74b5fcc8191903fb83f348ad81d`, public audience, dedicated DB binding with rooms/sessions before migration. Existing deployment mirror was opened with source helper and matched application source. Live URL: https://cuyoo-table.warm-ghost-4468.chatgpt.site/ . This checkpoint is not a claim that the new code is live.

## Validation state

Baseline: all original 18 tests passed before edits.

Current: all 29 Node test entries pass (21 rule fixtures, seven real D1 integration subtests and their wrapper; final run 91 seconds). The additive room-state backup is also verified against an existing synthetic pre-migration room without changing its live state/version. Includes complete four/six-session matches/rematches, state restart, join/start/action races, fixed-seat replacement/old-access denial, grace/late-renewal behavior, and an 18-second live-socket test with NO target HTTP polling plus closure of a second tab. Expected scoring fixtures are independent, including negative caller penalty, repeated bonus, ties and six-to-eight. Targeted upgrade and replacement-in-cut/deal/play/review fixtures pass. Full source lint, TypeScript and production build pass.

Real local HTTPS QA uses the ACTUAL compiled production Worker/assets and shared isolated D1; Chromium contexts have independent cookies and real deadlines. It is not an animation mock or a hosted public staging deployment. Four- and six-player browser runs passed 16/24 plays, both complete all-pass rounds, visible packet steps/reduced motion, new-device active-hand replacement, swipe/keyboard, refresh/brief offline, independent saved themes, permanent review/nonhost dismissal, five-second host gate/reload and expired-seat replacement. Final four/six browser runs both pass on the final application source (66 and 73 seconds; 16/24 UI plays; 6/8 independent contexts including replacement devices). Public result screenshots in both themes were visually inspected. Evidence: `docs/confirmed-rules-evidence/results.json` and its four public count screenshots. Private cookie/hand payloads are not serialized; only aggregate results and public completed-count screenshots are retained.

Observed issues fixed before rollout: missed zero-card deal state due to first poll timing; center face selector accidentally inheriting caption colors; SSE transport failing to reliably observe last-browser closure (replaced with verified WebSocket leases); dark seat badge background contrast. Rejected stale HTTP409 requests resynchronize normally. Deliberate old-occupant HTTP403 checks are expected.

## Authorized rollout in progress

- GitHub main and original implementation heads were reverified unchanged. Existing Site/version 8/public audience and dedicated DB were reverified. The additive migration backs up existing rooms privately before decoder upgrade; final validation gates have passed.
- Commit/push, open and merge an implementation PR only after checks pass; preserve original implementation history and supersede PR #1.
- Mirror the exact validated source through the Sites source helper, build/package, save version and deploy through existing free process. Verify returned commit/version/configuration and live smoke-test synthetic sessions.
- Record PR/commit, migration/deployment IDs and final evidence here. Stop only for an actual blocker; never label a saved commit a deployed update.
