# Project rename and rollout record

Status: approved rollout in progress, 2026-11-02. The existing public repository has been renamed to [`TheTexta/discord-shoot-manager`](https://github.com/TheTexta/discord-shoot-manager), retaining repository ID `1398755756`. The project/package identity is **Discord Shoot Manager** / `discord-shoot-manager`. Discord remains **TVM Bot**. Publishing and production verification are recorded below when completed.

Rename the existing GitHub repository, not a replacement fork, to retain history/issues/stars. Keep TVM's Discord application ID, account/token, invite, nickname, and commands; the reusable application is the backend supporting that identity. No central backend service is required.

## Approved rollout checklist

1. Record known-good commit/configuration and backup; reconcile local/user/upstream changes.
2. Confirm target-name availability and approve the exact repository rename. Completed: existing repository renamed in place; old URL redirects, repository remains public.
3. Update title/description/topics, package/lockfile metadata, README, contribution templates, CI labels, Docker source metadata, and direct `/source` URL.
4. Update local remotes and Coolify Git source; verify deploy-key/webhook access. Preserve the existing application UUID, service identity, persistent mount, and one-replica stop-before-start policy.
5. Check old/new GitHub URLs, source availability without login, CI/build, and controlled-server compatibility before rollout.
6. Keep rollback tied to compatible code/configuration and database backup. Do not rename databases, migration metadata, volumes, `tvm:` interactions, or `TVM shoot …` recovery markers as a branding sweep.

GitHub [redirects renamed repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository), but update references directly and do not recreate a repository at the old name, which would break redirects. Reusable Actions references and Pages URLs have exceptions; audit them if introduced later. Preserve AGPL-3.0-or-later, upstream attribution, and accessible source for the deployed version.
