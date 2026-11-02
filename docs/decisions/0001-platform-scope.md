# 0001 — Reusable single-guild shoot management

Status: accepted for local implementation, 2026-11-02. Production rollout is separate.

[Decision 0002](0002-project-identity.md) supersedes the temporary hold on project/repository naming below. It does not change deployment isolation, Discord identity, or persistence compatibility.

## Decision

Generalise the existing application in the same repository. Each organisation runs one deployment, Discord application/token, configuration, and database for one guild. Shoot management can run without roster verification. Existing TVM and membership-only installations remain supported; membership defaults enabled to avoid accidental access-policy changes.

Keep a modular application rather than introducing a central hosted backend, plugin framework, web dashboard, multi-guild tenancy, or database migration. Configure existing behavior that actually varies: eligible/admin/production roles, resource IDs, deployment timezone, and validated wording overlays.

## Compatibility

Preserve project/package/repository/Discord names for now; legacy environment aliases; source availability and AGPL attribution; database/volume paths and applied migrations; interaction/recovery identifiers; roster ownership/privacy guarantees; explicit private-channel policy; single-replica operation. Management authority, ordinary eligibility, and production-wide visibility are separate.

## Consequences

The same source supports TVM Bot and other independently hosted bots without forks. More deployments mean independent operations/backups, not central multitenancy. Roster tiers remain the existing model inside an optional capability. Missing mail credentials fail an enabled membership setup rather than disabling it. New features such as reminders, attendance, and production responsibilities are outside this decision. A [GitHub rename](../plans/project-rename.md) needs a later approved change, not a Discord rename.
