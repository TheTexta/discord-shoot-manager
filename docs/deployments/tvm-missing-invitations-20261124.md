# TVM missing-invitation rollout

Status: deployed and verified on **2026-11-24 UTC**.

Runtime source: `f4f1d91d8ce394cc5585f5815c83aa9b65041d62` (`Fix stale invitations for missing shoot channels`). Coolify deployment `wbz3vdk4mhs2nn00hhavvltr` finished successfully. The running image matches this commit; one healthy application container remains with zero restarts. This verification record is documentation-only and does not require another bot deployment.

## Preparation

- Integrated the existing remote documentation update without discarding local work. Unrelated local deployment notes and skill files were excluded from the release commit.
- All 241 tests, lint, formatting, and documentation checks passed.
- The Linux amd64 image built successfully and passed the non-root container smoke check with networking disabled.
- Created a mode-0600 SQLite backup under the persistent configuration directory's private `backups/` directory using SQLite's backup operation. Its integrity check passed. The backup was retained on the host; this rollout did not establish an encrypted off-host backup.
- Captured pre-deployment resource IDs and data checksums. The consistent container name and 30-second stop grace period were already configured; no configuration change was needed.

## Production acceptance

- All three surviving stale invitations now show unavailable status, disabled reaction joining, and no dead channel mention.
- Only those three invitation bodies changed. Saved invitation IDs and message existence were unchanged; no channels or invitation messages were recreated.
- All 19 shoot records and 15 existing workspace channels remained. All 15 saved brief messages were present and pinned.
- Stored crew, roster, account claims, roster metadata, and schema-migration checksums were unchanged. Shoot-record differences were limited to normal startup revision increments on open shoots; shoot details and IDs were unchanged. Schema version remains 8.
- Channel IDs, names, parents, and recovery markers were unchanged. The deployment-window audit contained no channel or permission-overwrite edits. Discord returns permission arrays in varying orders, so raw array hashes were not treated as semantic permission changes; consecutive normalized snapshots agreed.
- The heartbeat was ready, connected, and fresh. All 19 live Discord setup checks passed. Startup logs showed no failed membership operations or shoot errors; `/source` remained registered.
- GitHub Actions passed both the test/audit and container jobs for the runtime commit.

The missing-channel records remain missing. Updating their invitation posts does not restore a channel, merge a replacement's crew, or resolve a missing-channel incident. Other investigation findings remain separate work.

See [shoot workflows](../guides/shoots.md), [recovery guarantees](../architecture/persistence-and-recovery.md), and [deployment/rollback](../operations/deployment.md).
