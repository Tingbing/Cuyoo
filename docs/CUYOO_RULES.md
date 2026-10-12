# Wisconsin Cuyoo — confirmed rules

Four or six players choose Team A or Team B in the waiting lobby. New ordinary participants begin unassigned; each team holds exactly half the selected player count. The verified host may start only when every required participant is connected and the chosen teams are full and balanced. Start preserves join order within each chosen team and maps them into alternating fixed game seats (A-B-A-B or A-B-A-B-A-B). Usernames are anonymous display labels; the server cookie authorizes the current occupant. Match target is seven; negative scores and awards beyond seven are preserved.

Initial dealer is securely random only at match/rematch start. Cutter is right of dealer; trump decisions and first trick lead start left of dealer. Each completed or passed attempt advances the dealer clockwise exactly once. Later trick winners lead.

## Cards, cut, and packets

The 24-card deck contains 9, 10, J, Q, K, A in four suits. Shuffle is cryptographic Fisher–Yates; cutting rotates at a whole gap 1–23. Deal two cards clockwise to each seat, then two more clockwise, preserving actual allocation order. Each 360ms packet has a server delivery time after a brief 1200ms table synchronization prelude. Private projections expose zero, two, then four own cards. Other hands and unused deck stay private. Reduced motion preserves the same timings/order.

Four players receive 16 cards. First unused card proposes trump. After all four pass, the next unused card proposes trump in another complete clockwise round, even if its suit is the same. After both rounds pass, advance dealer, reshuffle and cut a new hand; no automatic caller/trump.

Six players receive all 24 cards. Dealer's last dealt card proposes trump and stays in that hand. After one complete all-pass round, advance dealer and redeal. There is no second suit-choice round. Accepting either eligible proposal ends decisions immediately and records the caller by stable seat/team.

## Legal play and winners

A > K > Q > J > 10 > 9. Jacks keep their printed suit; no bowers or obligation to overtrump.

If holding the suit led, follow it OR play trump. If void in the suit led, ANY owned card is legal, even while holding trump. Trump led must be followed if held. A leader may lead any owned card. Every input uses the same server action; the server independently validates ownership, phase, turn, occupancy, version and hand IDs.

Highest trump wins; otherwise highest card of the led suit. Four tricks per played hand. Center faces stay bright, and every trump card has a gold outline distinct from the winning-card glow.

## Points and review

| Rank | Captured points |
| --- | ---: |
| Ace | 4 |
| King | 3 |
| Queen | 2 |
| Jack | 1 |
| 10 / 9 | 0 |

More captured card points wins +1, or +2 with the single shared pending bonus. A losing caller loses exactly ONE point. A tie changes no scores/penalty and sets the same bonus. Passed attempts change no scores and also set it. Repeated ties/passes never compound: the next decisive win is always TWO maximum and clears the bonus. Six to eight wins the match. Rematch clears scores/bonus/history and selects a fresh random dealer.

Scoring is saved once before durable result review. Everyone keeps their own results until tapping/swiping/closing them. Nonhost dismissal affects only that occupant. The CURRENT host's accepted dismissal sets a single server deadline exactly 5000ms later. Repeat requests, reloads and host transfer do not extend it. At expiry, all panels close; a vacancy pauses the next hand without rescoring/restarting the gate. A final winning review goes to match complete instead of another deal.

## Leave, reconnect and replacement

Stable seats own team, cards and game responsibility. Occupants own identity, name, connection and an increasing epoch. Leave releases the exact seat immediately during any phase; it preserves cards, contributions, scores, bonus, actor, dealer and review/deal IDs. A new device can claim an advertised vacancy, inherit the remaining private hand, and resume automatically once the table is ready. Concurrent claims admit one occupant; former occupants cannot read or play that seat.

A server-verified WebSocket connection keeps live background tabs present. The last socket closing marks observed loss; absence of heartbeats is detected after six seconds. From observed loss, reserve for TEN seconds. Reconnect before expiry cancels the deadline; at/after expiry normal admission is required. One tab closing does not evict a device with another live connection. Server-request reconciliation releases due seats atomically and survives restarts.

Gameplay pauses while any required seat is vacant/reconnecting. Presentation may finish, and a started review deadline can expire. On host release, transfer to the first connected occupied seat; if none exists, the first admitted/returning connected occupant becomes host. Preserve any review deadline. A replacement inherits the departed fixed seat and team; team controls never reassign an active hand.

## Initial-leader teammate request

After trump is selected and before the first card of the hand, each other human teammate of the initial leader may send one predefined **Lead trump** request. The server derives the target from `(dealer + 1) mod N`; caller identity is irrelevant. Only the current occupant of that leader seat receives the sender name. It is advice only: it reveals no hand, changes no legal card, and does not alter bot strategy. The first accepted card or any new/redealt hand clears the request.

## Six-hour table lifetime

Creation and accepted meaningful human room actions set activity from authoritative server time. A table expires after six hours without such use, in waiting, active, complete, or test mode. Join/resume, team selection, game actions, result dismissal, teammate request, and rematch count. Global lobby reads, polling, presence heartbeats, bot moves, derived timers, cleanup, rejected requests, and duplicate retries do not. At the cutoff the table cannot be resumed or revived; private live room state is deleted by bounded server cleanup.

## Controls and display

Tap/click/Enter play remains available. Drag/swipe a legal card upward at least 48px (6% viewport height, capped at 80px), with upward movement at least 1.25 times sideways movement. Short/sideways/canceled drags return without mutation. Pending actions block duplicates; rejection restores the unchanged hand via authoritative resync. Escape or the Continue control closes review; review swipes are separate from card play.

The main-page light/dark toggle stores a device preference, applies before first paint, and respects the system preference when no explicit choice is saved. Other devices keep independent themes. Local-seat duplicate backs and visible hand headings are removed; other seats retain backs.
