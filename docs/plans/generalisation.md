# Generalisation implementation status

Status: phases 1–3 implemented; publishing, repository rename, and TVM rollout now separately approved. Production verification is recorded in the [rename/rollout record](project-rename.md). Scope is defined by [decision 0001](../decisions/0001-platform-scope.md) and the later [identity decision](../decisions/0002-project-identity.md).

| Phase                                 | Implementation                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Document current behavior         | Indexed Markdown guides/reference/architecture/development/operations; TVM profile; accepted decisions, clearly proposed plans, archives, and forwarding pages. Existing privacy, role ownership, preview/confirmation, synchronization, and recovery guarantees retained.                                       |
| 2 — Reusable deployment configuration | Neutral settings with conflict-checked legacy aliases; explicit eligible roles separate from management/production access; validated IANA timezone for parsing/editing; immutable validated partial `UI_TEXT_PATH` overlays and a generic example. TVM defaults retained.                                        |
| 3 — Optional membership               | Explicit `MEMBERSHIP_ENABLED=false`; no mail, verification secret, membership repository/modules, Unverified management, or membership reconciliation. Enabled-only commands/health/diagnostics; stale interactions rejected privately; shoot draft cleanup, role updates, recovery, and shutdown remain active. |
| 4 — External deployment acceptance    | Automated isolated fixtures are present; a real second-organisation/test-server installation is separate work. The existing TVM deployment is the approved production rollout target.                                                                                                                            |
| 5 — Project rename                    | [Approved rollout](project-rename.md): GitHub repository renamed in place to `TheTexta/discord-shoot-manager`; Discord remains TVM Bot.                                                                                                                                                                          |

No migration is added and no legacy data, identifier, database filename, service, or volume is renamed. Project branding changes only through the separately approved identity decision. Tests cover compatibility and the no-membership path. See [testing](../development/testing.md); passing local tests do not certify live Discord configuration.

## Initial local verification — 2026-11-02

Before the later rename/deployment authorization:

- `npm run check`: passed lint, formatting, 26 active-document checks, and all 201 tests.
- `npm audit --omit=dev --audit-level=moderate`: no vulnerabilities reported.
- Expanded smoke script: passed locally as a non-root user against isolated temporary SQLite files, covering enabled/disabled membership persistence and health.
- Docker image build/container execution was not run locally because that Docker daemon was unavailable; CI retains image build and smoke checks.
- No live Discord test-server acceptance, production changes, push, deployment, or rename had been performed at that checkpoint. Subsequent evidence belongs in the [rollout record](project-rename.md).
