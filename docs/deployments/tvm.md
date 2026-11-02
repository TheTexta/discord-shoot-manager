# TVM deployment profile

Status: runtime release `e06dbf3` deployed and bot-setup verified on 2026-11-02; see the [rollout evidence](../plans/project-rename.md#completed-rollout-evidence). The human-channel policies below remain a compatibility record, not a comprehensive fresh audit of every account/child channel.

## Identity and configuration

- GitHub/project: `TheTexta/discord-shoot-manager` / Discord Shoot Manager. The original `TheTexta/tvm-discord-bot` repository was renamed in place, retaining history and its repository ID.
- Discord application/account identity: **TVM Bot**. Preserve the existing application ID, bot ID/token, and server installation. A future GitHub rebrand does not require a new bot or invite.
- Existing `TVM_*` settings remain supported; membership defaults enabled; wording remains in root `ui-text.json` unless an override is deliberately configured.
- Default input/edit timezone: `America/Toronto`.
- SQLite location/Compose service/volume stay unchanged. Run one replica, no public HTTP route, with persistent config and private alerts.

Discord application name, bot username, and server nickname are separate settings. A server nickname can override the username. Earlier operations documentation recorded no TVM nickname; verify live settings before any future change. An account rename can use Discord's [modify-current-user interface](https://docs.discord.com/developers/resources/user#modify-current-user), but no such request is necessary or performed by generalisation. Keep the token private.

## Membership and human visibility

General Member is the base tier. Editors/producers also receive Executives (Producers & Editors); roster admins also receive Admin Team. Admin Team grants bot-management authority by configured ID, not Discord Administrator permission.

Manually assigned Admin Team members may lack General Member. Member channels must explicitly allow their intended access. Unverified is removed when any other role exists; changing it does not repair missing channel allows.

The existing operational policy is: allow Admin Team View Channel on General Members and its member channels. General Members, gm-discussion, and MEETING were documented as synchronized; learning-resources needs its own independent overwrite. Pitches and all-things-production were documented as already allowing Admin Team. Preserve separate editors/IT/archive/private restrictions and unrelated overwrites. Verify actual state before applying anything; categories alone do not prove child access. See [Discord permissions](https://docs.discord.com/developers/topics/permissions).

Test Admin Team without GM, GM alone, and roleless/Unverified users. Administrative Access includes Discord Administrator bypass and is not evidence that ordinary role access works. The setup diagnostic does not audit all these human profiles.

## Production access

The separate **all production access** role has no server-wide permissions and sits below Admin Team and the bot. Configure its ID using the existing `TVM_PRODUCTION_ACCESS_ROLE_ID` or neutral alias. Assign/remove it manually; roster synchronization never manages it. It grants viewing/posting across active/archived shoots and TVM's Broadcast/Post Credits channels. It grants neither management authority nor ordinary eligibility by itself.

Admin Team alone retains management and access to its own/joined shoots, not blanket visibility. Discord administrators/owner bypass channel restrictions. During the earlier production-access rollout, startup replaced shoot-level Admin Team overwrites with production-access overwrites; ordinary production categories and independently configured children require deliberate manual policy updates. Preserve unrelated production-group/member overwrites, and grant production access on active/archive categories too. Verify after reconciliation; generalisation does not authorize automatic server-wide permission repair.

For current generic rules, use the [permission reference](../reference/permissions.md); for hosting, use [deployment](../operations/deployment.md). Ticket Tool may continue managing unrelated tickets; the bot does not edit those channels.
