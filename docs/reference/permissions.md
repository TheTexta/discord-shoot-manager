# Permission reference

## Separate authority from visibility

| Profile                              | Manage bot/shoots                          | Ordinary shoot admission                                                     | View unrelated shoots | Archived posting                              |
| ------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- | --------------------- | --------------------------------------------- |
| Eligible role                        | No                                         | Yes                                                                          | No                    | Read-only when participating.                 |
| Bot-admin role                       | Yes                                        | Only if included in eligible roles; included in membership-derived defaults. | No                    | Yes when participating.                       |
| Production-access role only          | No                                         | No                                                                           | Yes                   | Yes through role-based access.                |
| Organiser                            | Management still requires admin authority. | Creator retains access.                                                      | No                    | Follows current admin/production permissions. |
| Discord Administrator / server owner | Discord bypass applies.                    | Human administrators qualify.                                                | Yes, bypass           | Yes, bypass.                                  |
| Roleless/unverified outsider         | No                                         | No                                                                           | No                    | No.                                           |

Email verification records are not required for shoot participation. Shoot eligibility comes from current configured Discord role IDs or Discord Administrator permission. An explicit `SHOOT_ELIGIBLE_ROLE_IDS` list replaces defaults. Production-access and administrative roles are deliberately separate. The bot never assigns/revokes production access through roster synchronization.

Private chats use explicit overwrites, not inherited category policy. Participants, organiser, bot, production-access holders, and Discord administrators can see them. Ordinary participants cannot create threads; archives deny ordinary posting and thread sending. Participating bot administrators and production-access holders retain archive posting. A maximum of 98 currently eligible participants includes the organiser; inactive historical invitations do not consume seats.

## Bot permissions

- Membership: Manage Roles and a role above all roles it assigns/removes, including Unverified. Pre-existing role ownership remains protected.
- Invitation channel: View Channel, Read Message History, Send Messages, Embed Links, Add Reactions, Manage Messages.
- Both shoot categories: View Channel, Read Message History, Send Messages, Send Messages in Threads, Add Reactions, Embed Links, Attach Files, Manage Channels, Manage Permissions (Manage Roles), Pin Messages.
- Alert channel: View Channel and Send Messages. It must be an ordinary server text channel private to the bot, configured bot administrators, owner, and Discord administrators.

The production-access role must have no server-wide permissions, be manually manageable, and sit below the bot. Merely using shoot-only mode does not remove the Manage Roles permission needed to maintain channel overwrites. Eligible roles are read for policy, not assigned by shoot management; they need not sit below the bot.

## Checks and limitations

`npm run discord:check` checks token/application, Server Members Intent, configured role existence, enabled membership hierarchy, production-access role safety, bot access to selected shoot resources, and alert-channel privacy using GET requests only. Startup repeats safety checks and then synchronizes resources.

A passing setup check does not prove every human can/cannot access every server channel. Inspect independently configured children as well as categories and test ordinary accounts without Administrator bypass. TVM's manual policies are in [its deployment profile](../deployments/tvm.md). An [expanded human-access diagnostic](../plans/permission-diagnostics.md) remains proposed, not implemented.
