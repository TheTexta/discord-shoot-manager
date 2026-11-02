# Command reference

Commands register only in the configured guild after startup finishes. `/source` remains available during startup. Management authorization is rechecked on every interaction, button, and form submission; Discord command visibility is not an authorization guarantee.

## Always available

| Command   | Access   | Purpose                                        |
| --------- | -------- | ---------------------------------------------- |
| `/source` | Everyone | Public source repository for the deployed bot. |

## Shoots enabled

All these commands require the configured bot-admin role or Discord Administrator permission and an accessible server text channel. See [shoot workflows](../guides/shoots.md).

| Command         | Options / purpose                                                     |
| --------------- | --------------------------------------------------------------------- |
| `/shoot setup`  | Optional `members`: mention up to 70 members; prepare a private form. |
| `/shoot edit`   | Edit current shoot details/joining window.                            |
| `/shoot crew`   | Private list of invited/reaction-joined participants.                 |
| `/shoot add`    | Required `user`; add an eligible member to an open shoot.             |
| `/shoot remove` | Required `user`; remove from open/archive; organiser protected.       |
| `/shoot close`  | Read-only archive for ordinary participants.                          |
| `/shoot reopen` | Restore an active chat without resetting its joining clock.           |

## Membership enabled

| Command             | Access     | Options / purpose                                                |
| ------------------- | ---------- | ---------------------------------------------------------------- |
| `/verify`           | Everyone   | Private email/code verification.                                 |
| `/upload`           | Management | Required `csv` attachment; preview complete-roster replacement.  |
| `/postverify`       | Management | Publish a verification button.                                   |
| `/testmail`         | Management | Required `email`; send to a controlled inbox.                    |
| `/roster status`    | Management | Snapshot mode/version, sync progress, health.                    |
| `/roster audit`     | Management | Recent aggregate changes.                                        |
| `/roster reconcile` | Management | Retry role synchronization.                                      |
| `/roster repair`    | Management | Required `email`; repair linked account roles.                   |
| `/roster release`   | Management | Required `email`; unlink account, preserving roster eligibility. |
| `/roster transfer`  | Management | Required `email` and `user`; transfer account link.              |

With `MEMBERSHIP_ENABLED=false`, membership commands are not registered. Old verification buttons, code/email modals, roster confirmations, and stale membership commands receive a private disabled response without performing work. See [membership](../guides/membership.md) for saved-action/confirmation semantics.
