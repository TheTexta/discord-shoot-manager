# Discord Shoot Manager

A self-hosted Discord bot for coordinating private shoot workspaces, with optional roster-based membership verification. Each organisation runs its own bot, configuration, and SQLite database for one Discord server.

## Implemented functionality

- Create/edit shoots with free-text schedules, reaction joining, direct crew invitations, private chats, and close/reopen archives.
- Optionally verify one roster email per Discord account, synchronize membership roles, and preview/confirm complete CSV roster replacements.
- Run shoot-only without email verification; configure eligible/invite-only roles, wording, and timezone.
- Validate Discord setup, report private operator alerts, and recover persisted shoot resources after restarts.

## Local setup

Requires **Node.js 22.13+**, npm, and a dedicated Discord bot/application with a test server. Never use a production token or database for local testing.

1. For shoot-only mode, copy [`examples/shoot-only.env.example`](examples/shoot-only.env.example) to `.env.local` in a new checkout. Keep `MEMBERSHIP_ENABLED=false`; no roster, SMTP, or verification secret is needed.
2. Fill the bot/application/guild IDs, explicit eligible-role IDs, bot-admin and production-access roles, private alert channel, invitation channel, and distinct active/archive categories.
3. Enable **Server Members Intent** in the Developer Portal; install with `bot` and `applications.commands` scopes. No Message Content Intent is needed.
4. Grant the [required bot/channel permissions](docs/reference/permissions.md#bot-permissions), not Administrator. The production-access role must have no server-wide permissions and sit below the bot.

For membership instead, copy [`.env.example`](.env.example): membership defaults to enabled and additionally needs membership roles, a complete roster, Resend SMTP credentials with a verified sending domain, and a random `VERIFICATION_CODE_SECRET` of at least 32 characters. Put the bot above all roles it manages. Follow the [setup guide](docs/guides/setup.md) and [configuration reference](docs/reference/configuration.md) for either mode. Never commit secrets or real rosters.

From the repository root, after filling `.env.local`:

```sh
npm ci
npm run check
npm run discord:check
npm start
```

`discord:check` makes authenticated GET-only Discord requests; it does not prove every human's effective access. **Starting the bot registers commands and can create/synchronize Discord resources.** Use representative test accounts to check private-chat and archive access.

`npm start` loads `.env.local` when present; exported variables take precedence. The local database defaults to `./config/tvm.db`. Run **one process/replica per database and token**.

## Architecture and design

The CommonJS Node.js runtime uses discord.js, SQLite persistence/migrations, and optional Resend SMTP. `src/app` wires the runtime; `src/shoots` and `src/membership` own independent capabilities; `src/infrastructure` owns storage, mail, and health reporting; `src/shared` holds authorization, validation, and wording contracts. This is not a hosted multi-guild service.

Management authority is separate from production visibility and ordinary shoot eligibility. UI text supports validated partial JSON overrides without a source fork. Legacy `TVM_*` configuration aliases remain supported; conflicting aliases are rejected.

TVM's installation remains **TVM Bot**; the project rename does not change its Discord identity or workspaces. See the [TVM deployment profile](docs/deployments/tvm.md).

## Documentation

- [Documentation index](docs/README.md): operator guides, references, decisions, and clearly marked proposals/history.
- [Shoot workflows](docs/guides/shoots.md) and [membership/roster operations](docs/guides/membership.md).
- [Commands](docs/reference/commands.md), [permissions](docs/reference/permissions.md), and [wording overrides](docs/reference/configuration.md#wording-overrides).
- [Deployment and secret rotation](docs/operations/deployment.md), [backup/restore](docs/operations/backup-and-restore.md), and [troubleshooting](docs/operations/troubleshooting.md).
- [Architecture](docs/architecture/overview.md), [development checks](docs/development/testing.md), [contributing](CONTRIBUTING.md), and [security reporting](SECURITY.md).

## License and attribution

Based on [EmailVerify](https://github.com/lkaesberg/EmailVerify). Licensed under [AGPL-3.0-or-later](LICENSE); retain the license and upstream attribution. Historical upstream documentation is [archived](docs/upstream/README.md). Keep deployed source public; `/source` links to it.
