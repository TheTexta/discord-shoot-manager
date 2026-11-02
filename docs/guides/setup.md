# Set up a deployment

Requires Node.js 22.13+, a dedicated Discord bot/application, and one server per deployment. Start on a test server, not TVM's production token or database. Run one replica per database and token.

## Choose capabilities

| Mode                            | Setup file                                                        | Requirements                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Membership with optional shoots | [`.env.example`](../../.env.example)                              | Membership roles, roster, Resend SMTP, verification secret; shoots enabled by all three channel/category IDs.                             |
| Shoot-only                      | [`shoot-only.env.example`](../../examples/shoot-only.env.example) | `MEMBERSHIP_ENABLED=false`, explicit eligible roles, management/production-access roles, shoot channels; no email or verification secret. |

Copy the chosen file to `.env.local` and fill the values using the [configuration reference](../reference/configuration.md). Membership defaults to **enabled**, never inferred from whether mail credentials happen to exist. Both capabilities disabled is rejected.

## Prepare Discord

1. Enable **Server Members Intent** in the Developer Portal. This is still needed for role/access updates in shoot-only mode.
2. Install with `bot` and `applications.commands` scopes. No Message Content Intent is needed.
3. Configure a private administrator alert text channel. It may be readable only by the bot, configured bot-admin role, owner, and Discord administrators.
4. If using membership, put the bot above the membership/Unverified roles and grant Manage Roles. Do not grant the bot Administrator merely to bypass setup checks.
5. If using shoots, create an invitation text channel and separate active/archive categories, and a production-access role with no server-wide permissions below the bot. Grant the [required channel permissions](../reference/permissions.md). For shoot-only operation, explicitly list eligible role IDs; include the bot-admin role if it should confer ordinary participation eligibility.

```sh
npm ci
npm run check
npm run discord:check
npm start
```

`discord:check` makes authenticated **GET-only** Discord requests. It checks setup for enabled capabilities, not every human's effective channel access. It requires Discord configuration but no SMTP credentials or verification secret. `npm start` registers the enabled guild commands and can create/synchronize Discord resources; it is not a read-only diagnostic.

## Confirm behavior

Use representative test accounts to check: a permitted organiser can create a shoot; eligible members join/leave; outsiders cannot read private chats; closing gives ordinary participants a read-only archive; production visibility is separate from management. For membership, test generic verification feedback and complete-roster preview/confirmation with synthetic addresses you control.

For wording, copy [the generic override example](../../examples/generic-ui-text.json), edit only the values you need, and set `UI_TEXT_PATH`. Do not edit a source fork for each organisation. Set `SHOOT_TIMEZONE` to a valid IANA zone; existing TVM setups retain Toronto. See [deployment](../operations/deployment.md) before hosting the bot.
