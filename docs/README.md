# Documentation

**Discord Shoot Manager** manages private Discord shoot workspaces, with optional roster-based membership verification. TVM's installation remains **TVM Bot**. The reusable runtime is not a multi-server hosted service.

## Start here

| Reader                         | Documentation                                                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New operator                   | [Set up a deployment](guides/setup.md)                                                                                                                                                       |
| Shoot organiser or participant | [Shoot workspaces](guides/shoots.md)                                                                                                                                                         |
| Membership administrator       | [Verification and roster management](guides/membership.md)                                                                                                                                   |
| Server administrator           | [Permissions](reference/permissions.md), [configuration](reference/configuration.md), [commands](reference/commands.md)                                                                      |
| Hosting operator               | [Deployment](operations/deployment.md), [backup and restore](operations/backup-and-restore.md), [troubleshooting](operations/troubleshooting.md)                                             |
| Contributor                    | [Architecture](architecture/overview.md), [persistence and recovery](architecture/persistence-and-recovery.md), [testing](development/testing.md), [contribution policy](../CONTRIBUTING.md) |
| TVM operator                   | [TVM deployment profile](deployments/tvm.md)                                                                                                                                                 |

## Decisions, plans, and history

- [Accepted platform scope](decisions/0001-platform-scope.md).
- [Generalisation implementation status](plans/generalisation.md).
- [GitHub/project rename record](plans/project-rename.md) and [accepted identity decision](decisions/0002-project-identity.md): GitHub identity is independent of TVM Bot.
- [Expanded human-permission diagnostics](plans/permission-diagnostics.md): proposed, not implemented.
- [Initial rollout history](archive/initial-rollout.md) and [upstream archive](upstream/README.md): historical, not operating instructions.

## Maintaining these docs

Guides explain tasks; reference pages define exact settings, commands, and permission rules; architecture explains invariants; operations describe safe procedures. Link to the authoritative page rather than copying its reference tables. Update documentation in the same change as behavior/configuration. Mark proposals and historical records explicitly; never present local implementation as proof of production rollout.

Use synthetic examples only. Never include secrets, real member rosters, database files, or private account/channel reports. Run `npm run docs:check` and `npm run check` before submitting. Markdown formatting and relative links/heading anchors are checked locally and in CI; inherited upstream and archived historical material are excluded from active-document checks.
