# Project rename and rollout record

Status: completed and production-verified, 2026-11-02. The existing public repository was renamed to [`TheTexta/discord-shoot-manager`](https://github.com/TheTexta/discord-shoot-manager), retaining repository ID `1398755756`. The project/package identity is **Discord Shoot Manager** / `discord-shoot-manager`. Discord remains **TVM Bot**.

Rename the existing GitHub repository, not a replacement fork, to retain history/issues/stars. Keep TVM's Discord application ID, account/token, invite, nickname, and commands; the reusable application is the backend supporting that identity. No central backend service is required.

## Approved rollout checklist

1. Record known-good commit/configuration and backup; reconcile local/user/upstream changes.
2. Confirm target-name availability and approve the exact repository rename. Completed: existing repository renamed in place; old URL redirects, repository remains public.
3. Update title/description/topics, package/lockfile metadata, README, contribution templates, CI labels, Docker source metadata, and direct `/source` URL.
4. Update local remotes and Coolify Git source; verify deploy-key/webhook access. Preserve the existing application UUID, service identity, persistent mount, and one-replica stop-before-start policy.
5. Check old/new GitHub URLs, source availability without login, CI/build, and controlled-server compatibility before rollout.
6. Keep rollback tied to compatible code/configuration and database backup. Do not rename databases, migration metadata, volumes, `tvm:` interactions, or `TVM shoot …` recovery markers as a branding sweep.

GitHub [redirects renamed repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository), but update references directly and do not recreate a repository at the old name, which would break redirects. Reusable Actions references and Pages URLs have exceptions; audit them if introduced later. Preserve AGPL-3.0-or-later, upstream attribution, and accessible source for the deployed version.

## Completed rollout evidence

- Reconciled the five newer upstream commits, retaining existing verification/roster hardening, dependency fixes, and checkout/ESLint updates. Local agent-skill artifacts were excluded from publishing.
- Pushed runtime release [`e06dbf3`](https://github.com/TheTexta/discord-shoot-manager/commit/e06dbf3c0308e69056c4e07b719f244b7e9ea607) to `main`. [Release-branch CI](https://github.com/TheTexta/discord-shoot-manager/actions/runs/41491782056) and [main CI](https://github.com/TheTexta/discord-shoot-manager/actions/runs/41492092616) both passed: lint, formatting, 27 active-document checks, all 201 tests, production dependency audit, Linux Docker build, and non-root container smoke.
- Updated Coolify's existing Git source to the renamed repository. The same read-only deploy key remains attached; no new application, credentials, service identity, or volume was created. Auto-deployment settings were retained; this rollout was explicitly triggered through Coolify.
- Retained a mode-0600 SQLite `.backup` snapshot at `/usr/app/config/tvm-pre-discord-shoot-manager-20261102T172849Z.db`, owned by UID/GID 1000. Its integrity check passed; this is a private deployment rollback snapshot, not a claim of a new encrypted off-site backup policy.
- Coolify deployment `iznafjvbl9yrg3cbjwbdghlp` finished at `2026-11-02T17:33:35Z`, using runtime commit `e06dbf3c0308e69056c4e07b719f244b7e9ea607`. Container health and the application heartbeat check passed, with zero restarts and no unexpected startup-failure log entries.
- Fresh production `discord:check` passed every bot-setup/privacy/resource check. Discord application/account remained **TVM Bot**, bot/application IDs were unchanged, nickname remained unset, and the same seven commands were registered. `/source` resolves directly to the renamed public repository.
- Membership and shoots remained enabled with Toronto time. The existing one replica, consistent container name, 30-second shutdown allowance, and `/usr/app/config` volume were retained. Schema stayed at version 7. Read-only, deterministically ordered comparisons against the snapshot confirmed unchanged roster, claim, shoot-detail/resource, and participant records without publishing member data.

This record is a documentation-only follow-up to the deployed runtime release. No live membership transfer/roster replacement, test email, shoot creation, or comprehensive human-account permission audit was performed for acceptance. Existing automated fixtures cover those workflows; a real second-organisation installation remains separate work.
