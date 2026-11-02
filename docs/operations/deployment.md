# Deployment and upgrades

## Deployment

Use the Dockerfile or existing Compose service in Coolify. Follow [setup](../guides/setup.md) and the [configuration reference](../reference/configuration.md), run **one replica**, and persist `/usr/app/config`. No public port is needed. The container runs as UID/GID 1000; preserve that ownership and restrictive database permissions. Use a different Discord application/token, configuration, and database for each organisation. There is no shared hosted backend.

For local Compose:

```sh
docker compose --env-file .env.local up --build -d
```

In Coolify, enable **consistent container names** and set the stop grace period to **30 seconds** so deployments stop the previous bot before starting its replacement. Keep one application and one replica.

Before an upgrade, take a SQLite backup and confirm the test and container checks pass. Stop the old bot before starting its replacement: process-local locks cannot coordinate overlapping replicas. Shutdown drains accepted work with a 25-second deadline; allow at least 30 seconds before killing the container.

After deployment, run `npm run discord:check`, inspect the startup log and private alert channel, and confirm `/source` points to the deployed public repository. In a controlled test server, verify enabled capabilities: roster-based access/release/transfer when enabled, and reaction joining/private visibility/read-only archival when shoots are enabled. Avoid manipulating production members to perform smoke tests.

## Discord bot name and admin visibility

Project branding does not control the Discord application/account/nickname. TVM remains **TVM Bot**; no account update or re-invite is required. See [the TVM profile](../deployments/tvm.md) for server-specific human access and [permissions](../reference/permissions.md) for reusable policy.

## Activating authoritative roster control

When upgrading a membership deployment from the legacy merged roster, back up and follow [the authoritative-roster transition](../guides/membership.md#transition-from-legacy-rosters). No membership activation or CSV upload is needed for shoot-only deployments.

## Health and monitoring

`/roster status` reports snapshot mode/version, inactive links, reconciliation progress, protected roles, failures, and health timestamps. Reconciliation emits aggregate JSON summaries without member data. An upload reply confirms database acceptance and queued synchronization; inspect status for completion.

The bot writes a mode-0600 heartbeat beside its database every 15 seconds (`tvm.db.health.json`). The Docker healthcheck requires a heartbeat younger than 60 seconds, a ready Discord connection, successful membership reconciliation within two hours **when membership is enabled**, and successful shoot reconciliation within five minutes **when shoots are enabled**. Legacy heartbeat files without a membership flag still require membership freshness. It uses no public HTTP endpoint. Container health reports degradation; Docker's restart policy alone does not restart an unhealthy running container, so configure monitoring alerts in your hosting platform. Failed Discord writes retain ownership for retry. Shoot-only operators use the heartbeat, logs, and private alerts; `/roster status` is not registered.

The alert channel must be a server text channel readable only by the bot, configured Admin Team, server owner, or Discord administrators. Startup and `discord:check` reject ordinary role/member access. Tighten channel overwrites before upgrading if necessary.

## Backup and restore

Follow [backup and restore](backup-and-restore.md); do not copy a live SQLite main file without its committed WAL state.

## Maintenance scripts

`roster:check` is read-only and can run while the bot is active. **Stop the bot before running database-writing scripts**, including `import-initial-roster.js` and `update-roster-roles.js`. Their database connections do not participate in the runtime’s membership lock. Back up first, supply the expected row count, then restart and reconcile. Use `/upload` with the **complete current roster** for normal updates and explicitly confirm its preview. Downloads/previews are processed in arrival order; confirmed replacements use a version guard, so only a preview of the current version can apply. Invalid uploads do not change eligibility.

## Secret rotation

Rotate a compromised Discord token through the Developer Portal, replace the deployment value, and restart. For enabled membership, rotate Resend credentials by creating a replacement key, updating deployment, checking a controlled inbox with `/testmail`, and revoking the old key. To rotate `VERIFICATION_CODE_SECRET`, stop the bot, generate a cryptographically random replacement of at least 32 characters, update deployment, and restart. Existing challenges no longer validate; email-based rate-limit/audit HMAC identities change across retention windows. Claims and roster entries remain intact. Shoot-only deployments need neither of these membership secrets. Never log or commit secrets.

## Troubleshooting and rollback

See [troubleshooting](troubleshooting.md) and [recovery guarantees](../architecture/persistence-and-recovery.md). No schema migration is added by the membership-optional/configuration change. Keep existing database paths, volume names, migration metadata, and Discord recovery identifiers.

For rollback, stop the new bot and deploy the previous known-good commit against a compatible database. If a future migration is incompatible, restore the matching pre-upgrade snapshot rather than downgrading the schema in place. Never run the old and new bot concurrently.

The GitHub repository remains `TheTexta/tvm-discord-bot`. Keep Coolify’s application UUID, service identity, and data volume if its Git source URL changes later. The [project rename](../plans/project-rename.md) is not performed by this work.

## Production access

Follow [the permission reference](../reference/permissions.md) and [TVM's rollout policy](../deployments/tvm.md#production-access). Channel/role changes are separate operational actions, not implied by a source update.

## Changing capabilities or deployment copy

Stop before changing capability configuration. Set `MEMBERSHIP_ENABLED=false` only deliberately, keep explicit eligible roles and shoot resources, then restart one replica. This does not offboard members or delete retained membership data. Before re-enabling, restore the membership configuration and review the retained roster, claims, and role-ownership state; startup resumes synchronization. Use test-server acceptance first.

Custom `UI_TEXT_PATH` files must exist inside the image or be mounted read-only. The generic example is included in the image; custom overlays can live in the persistent configuration directory with appropriate ownership. Do not place credentials in copy files. Validate rendered forms/commands before rollout. No source-level or Discord rename occurs when applying overrides.
