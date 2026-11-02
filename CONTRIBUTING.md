# Contributing

Discord Shoot Manager supports reusable single-guild shoot-management deployments, with optional membership verification. TVM's installation remains TVM Bot; repository branding and Discord identity are separate. Open an issue describing the problem and expected behavior before proposing substantial workflow changes. Small fixes can go directly to a pull request.

Use Node.js 22.13+ and `npm ci`. Run `npm run check` before submitting. Add regression tests for behavioral fixes using temporary databases and Discord/mail adapters; tests must not require live credentials. For container changes, also run the smoke checks in [the development guide](docs/development/testing.md).

Describe the trigger, resulting behavior, and validation in your pull request. Keep changes focused. Preserve authoritative snapshot uploads, inactive account links, existing role ownership, private shoot permissions, and timezone parsing/edit consistency (Toronto by default) unless the change explicitly addresses those policies. Test enabled and disabled membership paths, neutral/legacy configuration, and recovery compatibility when touching them.

Append new numbered migrations rather than editing applied ones. Update operator documentation when configuration or user workflows change. Keep secrets, member rosters, and database files out of commits and issue attachments.

Use the [documentation index](docs/README.md): guides for tasks, reference for exact contracts, architecture for invariants, operations for runbooks, deployments for TVM-specific policy, decisions for accepted scope, and plans for unimplemented proposals. Run `npm run docs:check`; label implementation versus production rollout honestly. Keep archived upstream documentation historical, not a competing operator guide.

Contributions remain under AGPL-3.0-or-later. Retain existing copyright notices and attribution.
