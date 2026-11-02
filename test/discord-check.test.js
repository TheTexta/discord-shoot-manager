// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { PermissionsBitField, PermissionFlagsBits: P, ApplicationFlagsBitField } = require('discord.js')
const { loadDiscordConfig } = require('../src/app/config')
const { BOT_PERMISSIONS, ANNOUNCEMENT_PERMISSIONS } = require('../src/shoots/policy')
const { checkDiscord } = require('../scripts/check-discord')

function fixture({ membership = false, shoots = true } = {}) {
    const id = (n) => `1000000000000000${String(n).padStart(2, '0')}`
    const env = {
        DISCORD_BOT_TOKEN: 'fake-token',
        DISCORD_APPLICATION_ID: id(1),
        DISCORD_GUILD_ID: id(2),
        BOT_ADMIN_ROLE_ID: id(3),
        ADMIN_ALERT_CHANNEL_ID: id(4),
        MEMBERSHIP_ENABLED: String(membership),
        ...(membership ? { MEMBER_ROLE_ID: id(5), EXEC_ROLE_ID: id(6) } : {}),
        ...(shoots
            ? {
                  SHOOT_ANNOUNCEMENT_CHANNEL_ID: id(7),
                  SHOOT_CATEGORY_ID: id(8),
                  SHOOT_ARCHIVE_CATEGORY_ID: id(9),
                  PRODUCTION_ACCESS_ROLE_ID: id(10),
                  SHOOT_ELIGIBLE_ROLE_IDS: id(5)
              }
            : {})
    }
    const config = loadDiscordConfig(env)
    const botId = id(11),
        botRoleId = id(12)
    const role = (n, overrides = {}) => ({ id: id(n), position: 1, managed: false, permissions: '0', ...overrides })
    const roles = [
        role(2),
        role(3),
        role(5),
        role(6),
        role(10),
        role(12, {
            position: 10,
            managed: true,
            tags: { bot_id: botId },
            permissions: new PermissionsBitField([...BOT_PERMISSIONS, ...ANNOUNCEMENT_PERMISSIONS]).bitfield.toString()
        })
    ]
    const channel = (n, type = 0, overwrites = []) => ({
        id: id(n),
        guild_id: config.guildId,
        type,
        permission_overwrites: overwrites
    })
    const responses = new Map([
        [
            '/oauth2/applications/@me',
            { id: config.applicationId, flags: ApplicationFlagsBitField.Flags.GatewayGuildMembers }
        ],
        ['/users/@me', { id: botId }],
        [`/guilds/${config.guildId}`, { id: config.guildId, owner_id: id(99) }],
        [`/guilds/${config.guildId}/roles`, roles],
        [`/guilds/${config.guildId}/members/${botId}`, { roles: [botRoleId] }],
        [
            `/channels/${id(4)}`,
            channel(4, 0, [
                { id: config.guildId, type: 0, deny: P.ViewChannel.toString(), allow: '0' },
                { id: botId, type: 1, allow: (P.ViewChannel | P.SendMessages).toString(), deny: '0' },
                { id: config.adminRoleId, type: 0, allow: (P.ViewChannel | P.SendMessages).toString(), deny: '0' }
            ])
        ],
        [`/channels/${id(7)}`, channel(7)],
        [`/channels/${id(8)}`, channel(8, 4)],
        [`/channels/${id(9)}`, channel(9, 4)]
    ])
    const requests = [],
        logs = []
    const options = {
        log: (line) => logs.push(line),
        request: async (url, init) => {
            assert.equal(init.method || 'GET', 'GET', 'Diagnostics must never write to Discord')
            const pathname = new URL(url).pathname.replace('/api/v10', '')
            requests.push(pathname)
            const data = responses.get(pathname)
            return { status: data ? 200 : 403, ok: Boolean(data), json: async () => data }
        }
    }
    return { config, responses, options, requests, logs, id }
}

test('Discord diagnostics use GET only and require no mail/secret in all supported capability modes', async () => {
    for (const mode of [{ membership: false }, { membership: true }, { membership: true, shoots: false }]) {
        const f = fixture(mode)
        assert.equal(await checkDiscord(f.config, f.options), true, f.logs.join('\n'))
        assert.ok(f.requests.length > 5)
        assert.equal(f.config.codeSecret, undefined)
        assert.equal(f.config.resendApiKey, undefined)
    }
})

test('Discord diagnostics fail missing/inaccessible roles, unsafe production roles and public alerts', async () => {
    for (const failure of ['roles', 'production', 'privacy', 'channel']) {
        const f = fixture()
        if (failure === 'roles') f.responses.delete(`/guilds/${f.config.guildId}/roles`)
        if (failure === 'production')
            f.responses
                .get(`/guilds/${f.config.guildId}/roles`)
                .find((role) => role.id === f.config.productionAccessRoleId).permissions = P.Administrator.toString()
        if (failure === 'privacy')
            f.responses.get(`/channels/${f.config.alertChannelId}`).permission_overwrites[0] = {
                id: f.config.guildId,
                type: 0,
                allow: P.ViewChannel.toString(),
                deny: '0'
            }
        if (failure === 'channel') f.responses.delete(`/channels/${f.config.shoots.categoryId}`)
        assert.equal(await checkDiscord(f.config, f.options), false, `${failure}: ${f.logs.join('\n')}`)
    }
})

test('Discord diagnostics reject admission through a discovered Unverified role', async () => {
    const f = fixture({ membership: true })
    const id = f.id(13)
    f.responses.get(`/guilds/${f.config.guildId}/roles`).push({
        id,
        name: require('../ui-text.json').roles.unverified,
        position: 1,
        managed: false,
        mentionable: true,
        permissions: '0'
    })
    f.config.shootEligibleRoleIds = [id]
    assert.equal(await checkDiscord(f.config, f.options), false)
    assert.ok(f.logs.some((line) => line.startsWith('FAIL Unverified')))
})
