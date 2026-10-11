# Cuyoo

[Play Cuyoo online](https://cuyoo-table.warm-ghost-4468.chatgpt.site/).

Real multiplayer Wisconsin Cuyoo for 4 or 6 friends. Username-only entry, shared live table list, manual host start, alternating teams, animated card table, private hands, reconnectable seats and authoritative scoring to seven.

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

Enter a username, create a 4/6-player table and have friends join this same URL. The host starts once everyone is seated. The cutter uses the slider or leaves the deck; choose trump with Pass/Play, then tap lit legal cards. Reopen the same browser/device to reconnect.
