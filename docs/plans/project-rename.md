# Future project rename

Status: proposed, not performed. Current repository is `TheTexta/tvm-discord-bot`; Discord remains **TVM Bot**. Suggested future repository/package: `discord-shoot-manager`, project title **Discord Shoot Manager**, subject to availability and final approval.

Rename the existing GitHub repository, not a replacement fork, to retain history/issues/stars. Keep TVM's Discord application ID, account/token, invite, nickname, and commands; the reusable application is the backend supporting that identity. No central backend service is required.

## Checklist for a separate change

1. Record known-good commit/configuration and backup; reconcile local/user/upstream changes.
2. Confirm target-name availability and approve the exact repository rename.
3. Rename the existing repository. Update title/description/topics, package/lockfile metadata, README, contribution templates, CI labels, Docker source metadata, and direct `/source` URL.
4. Update local remotes and Coolify Git source; verify deploy-key/webhook access. Preserve the existing application UUID, service identity, persistent mount, and one-replica stop-before-start policy.
5. Check old/new GitHub URLs, source availability without login, CI/build, and controlled-server compatibility before rollout.
6. Keep rollback tied to compatible code/configuration and database backup. Do not rename databases, migration metadata, volumes, `tvm:` interactions, or `TVM shoot …` recovery markers as a branding sweep.

GitHub [redirects renamed repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository), but update references directly and do not recreate a repository at the old name, which would break redirects. Reusable Actions references and Pages URLs have exceptions; audit them if introduced later. Preserve AGPL-3.0-or-later, upstream attribution, and accessible source for the deployed version.
