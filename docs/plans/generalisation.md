# Generalisation implementation status

Status: phases 1–3 implemented locally; not evidence of production rollout. Scope is defined by [decision 0001](../decisions/0001-platform-scope.md).

| Phase                                 | Implementation                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Document current behavior         | Indexed Markdown guides/reference/architecture/development/operations; TVM profile; accepted decisions, clearly proposed plans, archives, and forwarding pages. Existing privacy, role ownership, preview/confirmation, synchronization, and recovery guarantees retained.                                       |
| 2 — Reusable deployment configuration | Neutral settings with conflict-checked legacy aliases; explicit eligible roles separate from management/production access; validated IANA timezone for parsing/editing; immutable validated partial `UI_TEXT_PATH` overlays and a generic example. TVM defaults retained.                                        |
| 3 — Optional membership               | Explicit `MEMBERSHIP_ENABLED=false`; no mail, verification secret, membership repository/modules, Unverified management, or membership reconciliation. Enabled-only commands/health/diagnostics; stale interactions rejected privately; shoot draft cleanup, role updates, recovery, and shutdown remain active. |
| 4 — External deployment acceptance    | Automated isolated fixtures are present; a real second-organisation/test-server install and production rollout are not performed by phases 1–3.                                                                                                                                                                  |
| 5 — Project rename                    | [Proposed checklist](project-rename.md); no rename performed.                                                                                                                                                                                                                                                    |

No migration is added and no legacy data, identifier, database filename, service, volume, or project name is renamed. Tests cover compatibility and the no-membership path. See [testing](../development/testing.md) for verification commands; a passing local suite does not certify production Discord configuration.

## Local verification — 2026-11-02

- `npm run check`: passed lint, formatting, 26 active-document checks, and all 201 tests.
- `npm audit --omit=dev --audit-level=moderate`: no vulnerabilities reported.
- Expanded smoke script: passed locally as a non-root user against isolated temporary SQLite files, covering enabled/disabled membership persistence and health.
- Docker image build/container execution: not run because the local Docker daemon was unavailable. CI retains image build and smoke checks.
- No live Discord test-server acceptance, production inspection/change, push, deployment, or project rename was performed.
