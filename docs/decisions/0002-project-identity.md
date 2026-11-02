# 0002 — Discord Shoot Manager, deployed as TVM Bot

Status: accepted, 2026-11-02. The owner explicitly approved renaming the repository, pushing changes, and deploying the existing TVM application.

## Decision

Use **Discord Shoot Manager** as the project title and `discord-shoot-manager` as the GitHub repository/package identity. Rename the existing public `TheTexta/tvm-discord-bot` repository in place rather than creating a fork or moving ownership. Repository ID, history, issues, access, and deploy-key attachment remain associated with the same project.

TVM keeps **TVM Bot** as its Discord application/account/server identity. Update public source links, package metadata, CI/image labels, contribution/security links, local remote, and Coolify's source URL. Preserve the existing application UUID, token/application ID, volume/database paths, `TVM_*` compatibility variables, schema history, `tvm:` component identifiers, and shoot recovery markers.

## Consequences

The reusable backend is the same modular application, deployed independently per organisation. No central backend, new Discord installation, token rotation, new volume, or schema migration is needed. Leave the local checkout directory name and existing operational resource names intact to avoid disrupting other checkouts and maintenance paths. Keep the old GitHub name unused so redirects continue working. See the [rollout record](../plans/project-rename.md).
