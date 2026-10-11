# Wisconsin Cuyoo — implemented rules

## Table and turn order

Four or six players form two teams in alternating fixed seats: even seat indices Team A, odd Team B. The host manually starts only with every seat filled and connected. A match begins at 0–0; the first team to reach or exceed 7 game points wins. Negative scores are allowed.

Initial dealer is uniformly random on the server. Clockwise from dealer D, the cutter is (D−1+N) mod N; first trump actor and first trick leader are (D+1) mod N. Winners lead later tricks. After each completed, scored or tied hand, dealer advances one seat clockwise.

## Shuffle, cut and deal

Exactly 24 cards: 9, 10, J, Q, K, A in clubs, diamonds, hearts, spades. Unbiased cryptographic Fisher–Yates shuffle. The player right of dealer leaves the deck unchanged or selects a gap 1–23. Cutting rotates deck[k:] + deck[:k], with no subsequent shuffle.

Deal clockwise starting left of dealer in two-card packets, twice around: four cards each. No trump choice adds, removes or swaps cards.

With four players, eight cards remain undealt. The top undealt card proposes trump; if everyone passes, the bottom undealt card sets trump automatically, with no caller. The undealt cards never contribute to captured-card scoring.

With six players, all cards are dealt. Dealer’s last dealt card proposes trump and remains in the dealer’s hand, playable and visible to all as the sole private-hand exception.

## Trump decisions

Starting left of dealer, each player passes or plays the proposed suit. First acceptance immediately settles trump and identifies the caller’s team. If all six pass, a second round starts left of dealer and permits only the other three suits.

**Unconfirmed default 1:** if all six also pass in round two, reshuffle and redeal with the same dealer; no score or caller penalty. This is isolated in `game/engine.mjs`, with `DEFAULTS.sixAllPass` documenting the selected policy.

## Four tricks

Cards rank A > K > Q > J > 10 > 9 within their suit. Jacks never change suits; there are no bowers.

A player may follow the led suit OR play trump, even while holding the led suit. If they cannot follow but hold trump, they must trump. Only when holding neither the led suit nor trump may they discard any other suit. When trump is led, follow trump if held; otherwise discard freely. No requirement to overtrump or play higher.

Highest trump wins; if no trump was played, highest card of the originally led suit wins. An off-suit non-trump ace cannot win. Each trick has N played cards. Each hand has exactly four tricks.

## Card points and match points

| Rank | Captured card points |
| --- | ---: |
| Ace | 4 |
| King | 3 |
| Queen | 2 |
| Jack | 1 |
| 10 | 0 |
| 9 | 0 |

The team with more captured card points wins one game point plus any pending tie bonus. A losing caller’s team also loses one game point. Automatic four-player trump has no caller, so no penalty. Six-player hands total 40 card points; four-player hands count only the 16 dealt cards, with no fixed 21-point threshold. No sweep bonus.

A tie awards no game point and no caller penalty, and carries a +1 bonus to the next decisive hand.

**Unconfirmed default 2:** successive ties retain exactly one pending bonus, rather than accumulating unlimited bonuses. The next decisive hand clears it. `DEFAULTS.repeatedTies` documents this isolated scoring policy.

Scores are saved once atomically before count presentation. Refreshing or reconnecting cannot award a hand again. A rematch resets scores, tie bonus, hand history and match IDs and selects a fresh random dealer (the same seat may randomly be selected again).

## Membership and disconnection

Usernames are display labels, 2–24 characters, case-insensitively unique within a table. Anonymous device identity is an HttpOnly cookie, not a username. One device has one active seat. A second tab observes and becomes controlling only after the first tab’s lease expires.

A lobby player can leave; host transfers to the first remaining seat. During play disconnected seats/hands remain reserved. No replacement, automated play or forced cards: a missing player’s turn waits for them. Reopen on the same browser/device to resume. Completed matches may be left or rematched by the host.
