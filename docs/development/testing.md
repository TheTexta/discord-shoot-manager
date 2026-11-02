# Development and testing

Use Node.js 22.13+ and `npm ci`. Preserve existing user changes and keep each change focused. See [contribution policy](../../CONTRIBUTING.md) and [architecture](../architecture/overview.md).

```sh
npm run check
npm audit --omit=dev --audit-level=moderate
```

`check` runs ESLint, Prettier, documentation checks, and Node tests. `npm run docs:check` checks active-document Markdown conventions and relative file/heading links; it does not fetch external URLs or inspect secrets. `npm run format` formats repository content. Installed local agent-skill artifacts and inherited upstream docs are not project-formatting targets.

Tests use temporary SQLite databases and Discord/mail adapters, not live credentials. Cover legacy TVM environment variables and neutral aliases; membership+shoots, membership-only, and shoot-only modes; stale disabled interactions; explicit eligibility/production/admin separation; role changes; configurable timezone/DST and edit round-trips; validated partial copy overlays; health and shutdown. Existing roster privacy, ownership, preview/versioning, and lost-Discord-response regression suites remain required.

Shoot fixtures live under `test/helpers`. Lifecycle, forms, reactions, recovery, reliability, reporting, and permissions are separate suites. Synthetic diagnostic tests inject a request adapter that rejects non-GET methods. Live `discord:check` is read-only but needs credentials and is not a normal unit-test step. Starting the actual bot registers commands and may mutate Discord; do not use production tokens for automated smoke tests.

## Container checks

```sh
docker build -t discord-shoot-manager:test .
docker run --rm discord-shoot-manager:test node scripts/check-container.js
```

The smoke check runs as the non-root runtime user and covers native SQLite, migrations, private/writable persistence, membership and shoot-only storage/health, and import-safe startup. Debian bookworm in both stages keeps native bindings compatible. CI builds/checks the image separately from Node tests.

For a pre-existing root-owned data volume, back up first and arrange UID/GID 1000 ownership before deployment. A new volume is writable by the runtime user. Never use production recovery/permission changes as routine local verification.
