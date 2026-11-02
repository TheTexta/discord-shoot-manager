# Membership verification and rosters

This capability is enabled by default. It can run without shoots. Shoot-only deployments set `MEMBERSHIP_ENABLED=false` and need no roster, verification secret, SMTP, or Unverified role. Disabling membership does not revoke roles, delete data, or make shoots public. See [configuration](../reference/configuration.md).

## Verify an account

Use `/verify` or the published button, privately enter the email on the roster, then submit the emailed code. Each email links to one Discord account and each account to one email. Codes expire after 15 minutes and allow five attempts; request/send limits apply. A domain match alone is not eligibility. Student numbers do not participate.

Input validation and rate/availability checks precede a generic reply; eligibility lookup, challenge preparation, and SMTP happen afterward. An absent address receives the same generic reply as a listed one. Delivery errors never edit that reply or expose roster eligibility. SMTP acceptance is not proof of inbox delivery; operators can use `/testmail` with a controlled inbox.

TVM's tiers grant General Member, optionally Executives (Producers & Editors), and optionally Admin Team. Other deployments configure the corresponding role IDs and wording, but the roster tier model remains fixed. Roles that existed before bot management are protected independently for each tier. An inactive link is retained so a returning email regains its current tier without another challenge.

## Replace the complete roster

1. Prepare a CSV with `Email,Role` headers. Accepted roles: `GM`, `Exec - Editor`, `Exec - Producer`, `Admin`. Other columns are ignored. Limit: 2 MiB, 10,000 rows, no duplicate emails.
2. Validate locally: `npm run roster:check -- /path/to/eligible-members.csv`. Keep the real file outside Git.
3. Use `/upload` with the **complete** CSV. Review the private additions, omissions, tier changes, and demotions.
4. The same still-authorized administrator clicks **Replace entire roster** in the original channel. Upload alone changes nothing. Cancel discards the preview.
5. Inspect `/roster status` for background role synchronization, protected roles, and failures. Confirmation reports database acceptance, not completed Discord synchronization.

Previews expire after 10 minutes, restart, a new preview by that administrator, or any roster replacement. At most 20 previews are held in memory. Confirmation is bound to admin, guild, channel, and expected roster version; stale previews never silently overwrite newer state. Downloads/previews are serialized in arrival order. Invalid/cancelled/expired previews leave roster and verification codes unchanged.

Omitted emails lose eligibility; obsolete bot-owned roles are removed. Existing external roles and inactive identity links stay. Offboarding is done by omission from a confirmed replacement, not `/roster release`. External roles may continue conferring shoot eligibility and management authority. Do not assume CSV omission removes those protected privileges. `TVM_AUTO_ROLE_REVOCATION` is retired and ignored.

## Repair account links

Use `/roster repair email` or `/roster reconcile` to retry roles; `/roster release email` unlinks an account without removing roster eligibility; `/roster transfer email user` moves a link. See the [command reference](../reference/commands.md).

Saved replacements, transfers, releases, posts, and SMTP acceptance survive confirmation-delivery failure. Do not repeat them merely to obtain a reply. Check status/audit, then repair synchronization. Failed role removals retain ownership for retry; unknown/external ownership is never inferred from possessing a role.

## Transition from legacy rosters

Migration 7 preserves merged roster data, links, and role-ownership flags until the first confirmed authoritative snapshot. No role removals occur during that transition. Back up, deploy one replica, upload the complete current roster, review omissions/demotions, and confirm. The database cannot reconstruct old CSV contents.

Confirmed replacement increments the version, clears pending codes, audits aggregate differences, and activates authoritative control. Rejoining members regain their current tier. Reconciliation can be superseded by a newer snapshot and rereads account state under the shared membership lock. See [persistence and recovery](../architecture/persistence-and-recovery.md).
