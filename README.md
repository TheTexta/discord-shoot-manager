# Discord Shoot Manager

A self-hosted, single-guild Discord shoot manager with optional roster-based membership verification. It manages private shoot workspaces, crew participation, scheduling, access, and archives. With membership enabled, each roster email links to one Discord account and grants configured membership roles.

Each organisation runs its own bot/application, configuration, and database, with configurable roles, wording, and timezone, including **shoot-only mode without email verification**. TVM's installation remains **TVM Bot**, backed by this project; the GitHub rename does not change its Discord identity or existing workspaces. Start with the [documentation index](docs/README.md), [setup guide](docs/guides/setup.md), and [TVM deployment profile](docs/deployments/tvm.md).

## Quick start

Requires Node.js 22.13+ and a Discord bot. Membership is enabled by default and additionally requires a Resend key with a verified sending domain.

1. Copy `.env.example` to `.env.local` and fill in the values. Generate a random `VERIFICATION_CODE_SECRET` of at least 32 characters.
2. Enable **Server Members Intent** in the Discord Developer Portal. Install the bot with `bot` and `applications.commands` scopes.
3. Grant Manage Roles, View Channels, and Send Messages. Put the bot role above all membership roles and `Unverified`; configure a private administrator alert channel.

```sh
npm ci
npm run check
npm run discord:check
npm start
```

`npm start` loads `.env.local` when present; exported environment variables take precedence. The local database defaults to `./config/tvm.db`. Containers persist `/usr/app/config/tvm.db`. Run one replica.

Startup validates configuration, editable messages, roles, channel permissions, and administrator alert-channel privacy. Commands become available after initialization; `/source` remains available while starting.

For a shoot-only deployment, use [`examples/shoot-only.env.example`](examples/shoot-only.env.example) instead: explicitly set `MEMBERSHIP_ENABLED=false`, eligible role IDs, and all shoot resources. No roster, membership roles, SMTP, or verification secret is needed. Neutral settings accept legacy `TVM_*` aliases and reject conflicting values. See [configuration](docs/reference/configuration.md) for the complete contract and wording overrides.

## Membership

The following role names describe the default TVM profile; other deployments configure their own corresponding role IDs and wording.

Members receive `General Member`. Editors/producers also receive `Executives (Producers & Editors)`; admins also receive `Admin Team`. Codes expire after 15 minutes and allow five attempts. Requests and sends are rate limited.

Upload a CSV with `Email,Role` headers. Accepted roles are `GM`, `Exec - Editor`, `Exec - Producer`, and `Admin`. Other columns are ignored. Limits: 2 MiB, 10,000 rows, and no duplicate emails.

```sh
npm run roster:check -- /path/to/eligible-members.csv
```

`/upload` first shows a private preview of additions, omissions, tier changes, and demotions. Nothing changes until the same authorized admin clicks **Replace entire roster** in the same channel. The preview expires after 10 minutes, a restart, another preview by that admin, or an intervening roster replacement. Cancel discards it. Review omissions carefully: this is not a merge.

Each confirmed replacement replaces the complete active roster. Omitted emails lose roster eligibility; changed tiers remove obsolete bot-owned roles. Roles assigned before bot management remain protected independently for GM, Exec, and Admin. Inactive account links are retained, so a returning email automatically regains its current tier without another verification challenge. The retired `TVM_AUTO_ROLE_REVOCATION` setting is ignored. `Unverified` is assigned only to humans with no other roles.

Existing databases start in transition mode: their merged roster and existing roles are preserved until the first confirmed complete CSV replacement. `/roster status` shows whether snapshot control is active. Back up before upgrading, then upload and confirm the complete current roster. The confirmation reply reports database acceptance; Discord synchronization runs in the background and reports progress, protected roles, and failures through `/roster status`. Invalid, cancelled, expired, or stale previews leave the active snapshot unchanged. A failed confirmation delivery does not undo an accepted action; do not repeat saved releases or transfers merely to get a reply.

Verification replies are generic and sent before eligibility lookup or email delivery. An SMTP failure never changes that reply; operators receive a private alert. The reply does not guarantee inbox delivery.

## Common commands

Membership commands appear only with membership enabled; `/shoot` appears only with shoots configured. Stale membership buttons/modals/commands receive a private disabled response in shoot-only mode.

Management commands require the configured Admin Team role or Discord Administrator permission. The manually assigned `all production access` role controls visibility and participation across all shoots, Broadcast, and Post Credits; Admin Team alone does not grant that visibility. Admins retain access to shoots they organize or join.

| Command                                                                                                      | Purpose                                            |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `/verify`                                                                                                    | Request a code for your roster email.              |
| `/source`                                                                                                    | Open this bot’s source repository.                 |
| `/upload`                                                                                                    | Preview and confirm a complete roster replacement. |
| `/postverify`                                                                                                | Publish the verification button.                   |
| `/testmail`                                                                                                  | Send a delivery test to a controlled inbox.        |
| `/roster status`, `/roster audit`                                                                            | Inspect roster status and changes.                 |
| `/roster reconcile`, `/roster repair`                                                                        | Retry membership role synchronization.             |
| `/roster transfer`, `/roster release`                                                                        | Move or release a verified account claim.          |
| `/shoot setup`, `/shoot edit`, `/shoot crew`, `/shoot add`, `/shoot remove`, `/shoot close`, `/shoot reopen` | Manage private shoot chats when configured.        |

## Operator and contributor guides

- [All documentation](docs/README.md)
- [Shoot setup, joining, and archival](docs/guides/shoots.md)
- [Membership and roster operations](docs/guides/membership.md)
- [Configuration](docs/reference/configuration.md), [commands](docs/reference/commands.md), and [permissions](docs/reference/permissions.md)
- [Deployment and secret rotation](docs/operations/deployment.md), [backup/restore](docs/operations/backup-and-restore.md), and [troubleshooting](docs/operations/troubleshooting.md)
- [Development checks](docs/development/testing.md) and [architecture](docs/architecture/overview.md)
- [Expanded permission diagnostics investigation — proposed](docs/plans/permission-diagnostics.md)
- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)

Set `UI_TEXT_PATH` to a partial JSON overlay for deployment-specific wording, keeping keys/placeholders intact; [generic example](examples/generic-ui-text.json). Root `ui-text.json` remains TVM's default. Restart/redeploy after editing; use `/postverify` when enabled to publish updated verification copy. Recovery identifiers are fixed in code. Startup rejects invalid override keys, placeholders, and component lengths.

Based on [EmailVerify](https://github.com/lkaesberg/EmailVerify). Licensed under [AGPL-3.0-or-later](LICENSE); retain the license and upstream attribution. Historical upstream documentation is [archived](docs/upstream/README.md). Keep deployed source public; `/source` links to it.
