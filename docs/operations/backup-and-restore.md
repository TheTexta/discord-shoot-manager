# Backup and restore

Use SQLite's backup API or `.backup`; copying only a live main database can omit committed data in the WAL. Back up before upgrades, capability changes, and database-writing maintenance. These are operator actions, not diagnostics.

For the unchanged Compose service:

```sh
docker compose exec -T tvm-verification sh -c 'umask 077; sqlite3 /usr/app/config/tvm.db ".backup /usr/app/config/tvm-backup.db"'
docker compose exec -T tvm-verification sqlite3 /usr/app/config/tvm-backup.db 'PRAGMA integrity_check;'
```

Copy the snapshot off-host into private storage, encrypt with your managed backup key, and remove temporary snapshots. Keep backups outside Git. Record deployed commit, schema version, capability configuration, and backup time. Shoot-only databases use the same recovery procedure and retain the compatible schema; disabling membership never authorizes deleting old membership data.

Restore first into an isolated temporary database. Check integrity, numbered migration records, shoot/participant counts, and roster/claim counts when relevant. Opening a normal `Store` runs migrations, so use SQLite read-only inspection or an isolated copy for validation. Never attach a recovery test to the production token; use adapters or a dedicated test server.

For production restore: stop the bot, preserve the current database for investigation, replace it with the validated snapshot, remove obsolete WAL/SHM sidecars only while no process has the database open, restore UID/GID 1000 and mode `0600`, then start one replica and reconcile. Match runtime to schema: a database newer than the runtime is rejected. Rehearse recovery periodically.

For rollback, stop the new process before deploying a known-good compatible commit. If a migration is incompatible, restore its matching pre-upgrade snapshot instead of downgrading schema in place. The generalisation changes add no new migration; existing database and volume names remain valid. See [deployment](deployment.md).
