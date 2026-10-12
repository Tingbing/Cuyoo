# Cuyoo

[Play Cuyoo online](https://cuyoo-table.warm-ghost-4468.chatgpt.site/).

Real multiplayer Wisconsin Cuyoo for 4 or 6 friends. Username-only entry, shared live table list, click-to-join teams, authoritative host Start, alternating game seats, private hands, reconnectable seats and scoring to seven.

For a private practice match, choose four or six seats and select **Test game**. The server fills every other seat with clearly labeled bots, keeps the table out of the public lobby, and runs the normal deal, auction, trick, review, scoring and rematch rules. Only the human player's hand is revealed. Test games are intentionally single-human: nobody else can join, and leaving deletes the synthetic room immediately.

The server runs on Cloudflare Workers through Sites/Vinext with dedicated D1 storage. Clients submit intentions. The database atomically accepts one move per state version; browser animation and local storage never own game state.

```sh
bash scripts/install-pnpm.sh
npm run test
npm run typecheck
npm run build
```

See [exact game rules](docs/CUYOO_RULES.md), [deployment/recovery](docs/DEPLOYMENT.md), and [validation evidence](docs/VALIDATION.md), and [implementation checkpoint](IMPLEMENTATION_PROGRESS.md) for verification and deployment status. The two unconfirmed house-rule defaults are explicitly labeled.

Device sessions are secure anonymous cookies; no email/account flow. Your username is remembered locally for convenience, while your seat and match are durably stored on the server. Reopen the same browser to reconnect. During play a disconnected player’s turn waits for them.

This repository is independent of Tingbing/wiffle-ball-league and does not use its database.

Enter a username, create a 4/6-player table and have friends join this same URL, then click Team A or Team B. The host starts only when every connected player has chosen and both teams are full. During the first lead, the initial leader's teammates may privately ask them to lead trump; the request is advisory and never plays or restricts a card. Tables expire after six hours without an accepted human room action. Select **Test game** to practice against bots. Reopen the same browser/device to reconnect.
