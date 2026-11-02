# Troubleshooting

## Startup and configuration

- Conflicting aliases: remove one name or give neutral/legacy names the same value. Blank values are unset.
- Missing email settings: membership defaults to enabled. Configure it fully, or intentionally choose shoot-only mode with explicit eligible roles and shoot channels.
- Invalid timezone: use a valid IANA zone such as `America/Toronto` or `Europe/London`.
- Invalid copy: check `UI_TEXT_PATH`, known keys, exact placeholders, and rendered Discord component lengths. Do not edit recovery markers.
- Missing/unsafe role or channel: inspect actual IDs, bot hierarchy, [permissions](../reference/permissions.md), and private alert-channel access. Do not grant Administrator to paper over policy mistakes.

`npm run discord:check` is GET-only and mode-aware. It is not a complete audit of every human account or independent child-channel overwrite. The expanded audit remains [proposed](../plans/permission-diagnostics.md).

## Membership and saved actions

Role failures retain claims and bot-owned flags for `/roster repair` or reconciliation. A saved action whose reply failed is not undone. Inspect `/roster status` and `/roster audit` instead of repeating transfers/releases/replacements. If both initial and fallback confirmations fail, inspect logs and saved state first.

Verification replies are generic before eligibility lookup and delivery. Delivery failures alert operators without editing that feedback; never infer roster absence from a missing email. SMTP timeouts are bounded but acceptance does not establish inbox delivery. Test a controlled inbox and junk folder with `/testmail`.

In shoot-only mode, old membership commands/buttons/modals receive a private disabled response and make no membership change. Their disappearance from command registration does not delete old posts. Retained roster/claims/roles are not an error and should not be cleaned up as part of disabling verification.

## Shoot incidents

Synchronization runs each minute and at reconnect; role/access changes and member departure also trigger checks. Abandoned drafts expire after 30 minutes and are swept at startup/hourly. Keep channel-topic/message-footer markers intact.

Temporary background Discord/network failures log immediately but alert after two unresolved minutes. Permission and unexpected operational errors alert immediately. Search structured events by `reference`. Safe logs retain status, Discord code, method, sanitized route template, and source frames—not arbitrary exception text, request bodies, tokens, or emails. Alerts cannot ping roles/members. Cooldowns start only after delivery; failed deliveries retry. Incident state is process-local, so restart resets grace/history.

A successful permission sync does not resolve a deleted-channel incident or independent cosmetic cleanup failure. Missing briefs can be recreated; missing shoot channels are reported, not silently recreated. Do not repeat setup after a saved/pending response. See [recovery guarantees](../architecture/persistence-and-recovery.md) and the [shoot guide](../guides/shoots.md).

## Health and rollback

Use container health, heartbeat, logs, and private alerts; shoot-only mode has no `/roster status`. Health requires recent success for enabled capabilities only. Docker does not automatically restart a merely unhealthy running process; configure hosting alerts. Follow [backup/restore](backup-and-restore.md) before rollback and never overlap old/new replicas.
