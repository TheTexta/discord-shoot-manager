// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const { ApplicationFlagsBitField, PermissionFlagsBits } = require('discord.js')
const { loadDiscordConfig } = require('../src/app/config')
const { BOT_PERMISSIONS, ANNOUNCEMENT_PERMISSIONS } = require('../src/shoots/policy')
const { channelPermissions, assertPrivateAlertChannel } = require('../src/shared/channelPermissions')
const { unverifiedRoleName } = require('../src/shared/uiText')

const base = 'https://discord.com/api/v10'

async function checkDiscord(config, { request = fetch, log = console.log } = {}) {
    const {
        token,
        applicationId,
        guildId,
        memberRoleId,
        execRoleId,
        adminRoleId,
        unverifiedRoleId,
        alertChannelId,
        shoots,
        productionAccessRoleId
    } = config
    const membershipEnabled = config.membershipEnabled !== false
    async function get(path) {
        const response = await request(base + path, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(12000)
        })
        return { status: response.status, data: response.ok ? await response.json() : null }
    }
    const [application, bot, guild, roles, channel] = await Promise.all([
        get('/oauth2/applications/@me'),
        get('/users/@me'),
        get(`/guilds/${guildId}`),
        get(`/guilds/${guildId}/roles`),
        get(`/channels/${alertChannelId}`)
    ])
    const checks = []
    const check = (label, ok) => {
        checks.push(ok)
        log(`${ok ? 'OK' : 'FAIL'} ${label}`)
    }
    check('Bot token and application ID', application.data?.id === applicationId && Boolean(bot.data))
    const flags = BigInt(application.data?.flags || 0)
    const intents = ['GatewayGuildMembers', 'GatewayGuildMembersLimited']
    check(
        'Server Members Intent',
        intents.some((name) => Boolean(flags & BigInt(ApplicationFlagsBitField.Flags[name])))
    )
    check('Bot can access the configured server', guild.data?.id === guildId)

    let member
    if (bot.data && guild.data) member = await get(`/guilds/${guildId}/members/${bot.data.id}`)
    check('Bot is installed in the server', Boolean(member?.data))
    const roleIds = membershipEnabled ? [memberRoleId, execRoleId, adminRoleId] : [adminRoleId]
    const targets = roleIds.map((id) => roles.data?.find((role) => role.id === id))
    check('Configured management and enabled membership roles exist', targets.every(Boolean))
    const eligibleRoles = config.shootEligibleRoleIds || roleIds
    if (shoots)
        check(
            'Configured shoot-eligible roles exist',
            eligibleRoles.every((id) => roles.data?.some((role) => role.id === id))
        )
    const unverified = !membershipEnabled
        ? null
        : unverifiedRoleId
          ? roles.data?.find((role) => role.id === unverifiedRoleId)
          : roles.data?.find((role) => role.name === unverifiedRoleName)
    if (membershipEnabled && (unverifiedRoleId || unverified)) {
        check(
            'Unverified is a separate role with no permissions and mentions enabled',
            Boolean(unverified) &&
                ![guildId, memberRoleId, execRoleId, adminRoleId, ...eligibleRoles].includes(unverified.id) &&
                !unverified.managed &&
                BigInt(unverified.permissions) === 0n &&
                unverified.mentionable
        )
        targets.push(unverified)
    }
    const botRoles = roles.data?.filter((role) => member?.data?.roles.includes(role.id)) || []
    const highest = Math.max(0, ...botRoles.map((role) => role.position))
    if (productionAccessRoleId) {
        const production = roles.data?.find((role) => role.id === productionAccessRoleId)
        check(
            'Production access is a separate, manageable role with no server-wide permissions',
            Boolean(production) &&
                ![guildId, memberRoleId, execRoleId, adminRoleId, unverified?.id, ...eligibleRoles].includes(
                    production.id
                ) &&
                !production.managed &&
                BigInt(production.permissions) === 0n &&
                highest > production.position
        )
    }
    let basePermissions = BigInt(roles.data?.find((role) => role.id === guildId)?.permissions || 0)
    for (const role of botRoles) basePermissions |= BigInt(role.permissions)
    if (membershipEnabled)
        check(
            'Bot has Manage Roles and sits above all assigned roles',
            targets.every((role) => role && highest > role.position) &&
                Boolean(basePermissions & PermissionFlagsBits.ManageRoles)
        )
    check('Bot can access the configured alert channel', channel.data?.guild_id === guildId)
    if (channel.data && guild.data && member?.data && roles.data) {
        check(
            'Bot can view and send in the alert channel',
            channelPermissions(channel.data, guild.data, member.data, roles.data, bot.data.id)
        )
    }
    if (channel.data && guild.data && roles.data && bot.data) {
        try {
            await assertPrivateAlertChannel({
                channel: channel.data,
                guild: guild.data,
                roles: roles.data,
                botId: bot.data.id,
                adminRoleId,
                fetchMember: async (id) => (await get(`/guilds/${guildId}/members/${id}`)).data
            })
            check('Administrator alert channel is private', true)
        } catch (error) {
            check(error.message, false)
        }
    }
    if (shoots) {
        const definitions = [
            [shoots.announcementChannelId, 0, ANNOUNCEMENT_PERMISSIONS, 'Shoot announcement channel'],
            [shoots.categoryId, 4, BOT_PERMISSIONS, 'Active shoot category'],
            [shoots.archiveCategoryId, 4, BOT_PERMISSIONS, 'Archived shoot category']
        ]
        const shootChannels = await Promise.all(definitions.map(([id]) => get(`/channels/${id}`)))
        definitions.forEach(([, type, permissions, label], index) => {
            const data = shootChannels[index].data
            check(
                `${label} exists in this server with the expected type`,
                data?.guild_id === guildId && data?.type === type
            )
            check(
                `${label} grants the bot all required permissions`,
                Boolean(data && guild.data && member?.data && roles.data) &&
                    channelPermissions(data, guild.data, member.data, roles.data, bot.data.id, permissions)
            )
        })
    }
    return checks.every(Boolean)
}

if (require.main === module) {
    Promise.resolve()
        .then(() => checkDiscord(loadDiscordConfig()))
        .then((ok) => {
            if (!ok) process.exitCode = 1
        })
        .catch((error) => {
            console.error(`Discord setup check failed: ${error.name || 'request error'}`)
            process.exitCode = 1
        })
}

module.exports = { checkDiscord }
