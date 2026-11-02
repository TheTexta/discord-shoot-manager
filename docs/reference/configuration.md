# Configuration reference

Environment variables are read at process startup. `npm start` loads `.env.local` if present; exported variables win. No secrets belong in Git. The root [TVM example](../../.env.example) and [shoot-only example](../../examples/shoot-only.env.example) contain no credentials.

## Common and shoot settings

Neutral and legacy names are aliases. Values are trimmed; blank values count as unset. If both names have different nonempty values, startup fails instead of silently choosing one. Identical values are accepted. Legacy names remain supported with no removal scheduled.

| Setting                         | Legacy alias                        | Required / default                                                                                                                           |
| ------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_BOT_TOKEN`             | —                                   | Required; secret.                                                                                                                            |
| `DISCORD_APPLICATION_ID`        | —                                   | Required application ID.                                                                                                                     |
| `DISCORD_GUILD_ID`              | `TVM_GUILD_ID`                      | Required server ID; interactions from other servers are ignored.                                                                             |
| `DATABASE_PATH`                 | `TVM_DATABASE_PATH`                 | `./config/tvm.db`; health file is this path plus `.health.json`.                                                                             |
| `MEMBERSHIP_ENABLED`            | —                                   | `true`; only literal `true` or `false` accepted.                                                                                             |
| `BOT_ADMIN_ROLE_ID`             | `TVM_ADMIN_ROLE_ID`                 | Required; server-side management authority, not blanket shoot visibility.                                                                    |
| `ADMIN_ALERT_CHANNEL_ID`        | `TVM_ADMIN_ALERT_CHANNEL_ID`        | Required private server text channel.                                                                                                        |
| `PRODUCTION_ACCESS_ROLE_ID`     | `TVM_PRODUCTION_ACCESS_ROLE_ID`     | Required for shoots; separate from admin, membership, Unverified, and eligible roles. No server-wide permissions. Manually assigned/removed. |
| `SHOOT_ANNOUNCEMENT_CHANNEL_ID` | `TVM_SHOOT_ANNOUNCEMENT_CHANNEL_ID` | Invitation text channel. Set all three shoot resource IDs or leave all unset.                                                                |
| `SHOOT_CATEGORY_ID`             | `TVM_SHOOT_CATEGORY_ID`             | Active category; distinct from invitation and archive IDs.                                                                                   |
| `SHOOT_ARCHIVE_CATEGORY_ID`     | `TVM_SHOOT_ARCHIVE_CATEGORY_ID`     | Archive category.                                                                                                                            |
| `SHOOT_ELIGIBLE_ROLE_IDS`       | —                                   | Comma-separated role IDs. Required in shoot-only mode. With membership enabled, defaults to member, executive, and admin IDs.                |
| `SHOOT_TIMEZONE`                | —                                   | `America/Toronto`; valid IANA timezone for input and editing. Saved instants stay unchanged.                                                 |
| `UI_TEXT_PATH`                  | —                                   | Optional partial JSON override file, relative to the process working directory or absolute. Defaults to existing TVM copy.                   |

`@everyone`, duplicate eligibility IDs, invalid snowflakes, partial shoot configuration, and conflicting role purposes are rejected. Discord Administrator permission still bypasses ordinary eligibility; bots cannot join. An explicit eligible-role list replaces the membership-derived list: the bot-admin role is not implicitly added to it. Organisers retain their existing access exception. Production access alone grants neither management authority nor eligibility.

Compose intentionally retains service `tvm-verification`, volume `tvm_data`, and database `/usr/app/config/tvm.db`; its database location is fixed inside the persistent mount. Neutral database paths apply to direct Node/Docker/Coolify configuration, not the supplied Compose service.

## Membership-only requirements

These settings are required/used only while membership is enabled. Missing mail configuration never turns membership off.

| Setting                    | Legacy alias             | Required / default                                                         |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `MEMBER_ROLE_ID`           | `TVM_MEMBER_ROLE_ID`     | Required, distinct from executive and admin roles.                         |
| `EXEC_ROLE_ID`             | `TVM_EXEC_ROLE_ID`       | Required.                                                                  |
| `UNVERIFIED_ROLE_ID`       | `TVM_UNVERIFIED_ROLE_ID` | Optional; otherwise discover/create the configured Unverified role safely. |
| `VERIFICATION_CODE_SECRET` | —                        | Required random secret of at least 32 characters.                          |
| `SMTP_FROM`                | —                        | Required valid sender email.                                               |
| `RESEND_API_KEY`           | —                        | Required Resend SMTP credential.                                           |
| `SMTP_HOST`                | —                        | `smtp.resend.com`.                                                         |
| `SMTP_PORT`                | —                        | `465`; implicit TLS is required.                                           |

The roster tier model remains `GM`, `Exec - Editor`, `Exec - Producer`, and `Admin`; this is an optional capability, not a configurable universal identity system. `TVM_AUTO_ROLE_REVOCATION` is retired and ignored. Roster-writing maintenance scripts require membership enabled, guild/database configuration, and the verification secret; stop the runtime and back up before using them.

Disabling membership does not delete stored rosters/claims, remove already assigned roles, or sweep membership data. It stops membership work. Pending challenges retain their existing expiry and can expire while disabled. Re-enabling restores normal expiry checks and reconciliation; review retained state before doing so.

## Wording overrides

`UI_TEXT_PATH` overlays nested sections/keys from [`ui-text.json`](../../ui-text.json). Omitted values inherit defaults. The file is loaded once per process before Discord login; restart/redeploy after changes. Unknown keys/sections, non-string values, missing/extra placeholders, and Discord component-length violations are rejected. Named placeholders must match [`uiTextSchema.json`](../../src/shared/uiTextSchema.json).

Overriding `roles.unverified` changes presentation, not managed-role discovery. Without `UNVERIFIED_ROLE_ID`, discovery/creation uses the base file's Unverified name so a branding overlay cannot silently create a replacement role. Configure the explicit role ID when using a renamed existing role.

```json
{
    "shoot": { "setupTitle": "Create a studio shoot" },
    "alerts": { "message": "[Studio Bot] {message}" }
}
```

Non-Toronto forms use `shoot.zonedTimeLabel` and `shoot.zonedInvalidTime`, each with `{timezone}`; Toronto preserves the existing keys/copy. Keep rendered modal labels within Discord limits. Publish a new verification post after wording changes if desired. Recovery markers, component identifiers, and database metadata are not editable branding.
