# Persistence and recovery

One SQLite connection and serialized transaction queue are owned by `Store`/`SqliteDatabase`. Membership and shoots have focused repositories; optional membership is constructed only when enabled. The shared numbered migration history and schema remain unchanged by generalisation. Never edit applied migrations or rename `tvm_schema_migrations` for branding.

## Membership invariants

Roster replacement is a version-guarded transaction that replaces eligibility/tiers, clears pending codes, and records aggregate audit differences. Previews are process-local and never commit on preparation. Identity links survive omission; explicit transfer/release changes account linkage. Only persisted bot-owned role flags permit revocation; pre-existing roles stay protected. Intent is saved before ambiguous Discord writes so retries remain recoverable.

Membership operations share an account-by-account lock and reread current state. SMTP delivery uses a per-account queue after generic acknowledgement and challenge reservation. An intervening replacement/release/transfer invalidates a saved challenge; delivery never recreates it. Accepted work drains at shutdown. These guarantees remain active when membership is enabled and are not replaced by the generic shoot policy.

## Shoot lifecycle

Drafts and participant rows persist transactionally. A shoot progresses through draft/provisioning/open/closing/closed/reopening; missing-channel state is reported instead of silently making a replacement workspace. Commands save intended state before synchronizing Discord, so a lost response is distinguishable from an unsaved action. Retries converge without duplicate channels/messages.

Migration 8 adds nullable `call_date_text` and `call_time_text` without rewriting old `call_time` instants. New/changed schedules save literal text and clear `call_time`; blank text is distinct from legacy null columns. Unchanged legacy schedule fields preserve the exact original instant, including seconds/milliseconds, through edits to other details. Both messages and reopened forms use saved text. Reaction joining still uses independent numeric `join_started_at` deadlines. Back up before applying migrations; older runtimes reject a newer schema, so rollback requires the pre-upgrade database as well as the old runtime.

Topics and message footers use fixed `TVM shoot …` recovery markers; interaction identifiers retain `tvm:`. They are persistence contracts, not branding. Keep them readable across upgrades. Wording overlays never alter them. Existing timestamps remain absolute instants when a deployment timezone changes.

Reaction changes debounce for 250 ms with a trailing pass when dirty. Reconciliation reads fresh member roles once per shoot/pass, evicts transient failures, and never carries permission cache across passes/shoots. Current eligibility is checked for reactions, direct invitations, capacity, and synchronization. Organisers retain their documented access exception. Role/access changes and departures schedule reconciliation; the one-minute timer and reconnect catch missed events.

The existing participant `invited` flag distinguishes direct admission from reactions. Invite-only roles qualify only with that flag; rejection/cleanup of their reactions must not discard an occupied invitation seat. No new participant table or roster tier is needed.

Missing pinned briefs are recreated. Routine sync does not recreate deleted invitations; edit/reopen/startup may republish without pinging or resetting the original join deadline. Closed invitations are deleted 24 hours after close and stay deleted through edits/startup until reopening. Interrupted deletion/publication intent persists. Deleted shoot channels are marked missing and alerted, never automatically recreated. Missing records continue invitation reconciliation: surviving posts become unavailable with joining disabled, including existing missing records on startup. An ambiguously published invitation can be recovered and updated, but no invitation is sent for a missing workspace. Failed edits retry; existing close deadlines, crew, and shoot details remain intact. Updating the post does not imply channel recovery.

## Operational state

Durable database intent is separate from Discord acknowledgement. Saved changes survive failed confirmations; repair synchronization rather than repeating the original action. Incident/grace/recovery state and upload/form caches are process-local, not durable across restart. See [troubleshooting](../operations/troubleshooting.md).

SIGTERM/SIGINT stop new work/timers, flush accepted reactions, drain accepted operations, write stopping health, close mail if present and SQLite, then destroy Discord. The deadline is 25 seconds; allow 30 seconds before forced termination. Process-local coordination cannot protect overlapping replicas or writing maintenance scripts. See [backup/restore](../operations/backup-and-restore.md).
