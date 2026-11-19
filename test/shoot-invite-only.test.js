// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { Collection, PermissionsBitField, PermissionFlagsBits: P } = require('discord.js')
const { IDS, fixture, allows } = require('./helpers/shoot')

const roleId = '100000000000000016'

function serviceRequest(f, name) {
    f.config.shootInviteOnlyRoleIds = [roleId]
    const member = f.members.get(IDS[name])
    member.roles.cache.clear()
    member.roles.cache.set(roleId, { id: roleId, name: 'Service Request' })
    return member
}

test('invite-only roles work in setup and add, survive restart and follow archive permissions', async (t) => {
    for (const membershipEnabled of [true, false]) {
        await t.test(`membership ${membershipEnabled}`, async (t) => {
            const f = await fixture(t, { membershipEnabled })
            serviceRequest(f, 'invited')
            serviceRequest(f, 'outsider')
            const { shoot } = await f.create()
            assert.equal(shoot.status, 'open')
            const chat = f.channels.get(shoot.channel_id)
            assert.ok(allows(chat, IDS.invited, P.SendMessages))
            await f.store.updateShoot(shoot.id, { join_started_at: Date.now() - 86400001 })
            const add = f.interaction({ command: 'add', channelId: shoot.channel_id, addUserId: IDS.outsider })
            await f.service.handleInteraction(add)
            assert.match(add.replies.at(-1).content, /Added/)
            await f.restart()
            await f.service.reconcileAll()
            assert.ok(allows(chat, IDS.outsider, P.SendMessages))
            await f.service.handleInteraction(f.interaction({ command: 'close', channelId: shoot.channel_id }))
            assert.ok(allows(chat, IDS.outsider, P.ViewChannel))
            assert.equal(allows(chat, IDS.outsider, P.SendMessages), false)
            await f.service.handleInteraction(f.interaction({ command: 'reopen', channelId: shoot.channel_id }))
            assert.ok(allows(chat, IDS.outsider, P.SendMessages))
            assert.equal(f.errors.length, 0)
        })
    }
})

test('invite-only members cannot self-join, manage shoots, or regain removed invitations by reacting', async (t) => {
    const f = await fixture(t)
    const member = serviceRequest(f, 'outsider')
    const { shoot } = await f.create()
    const chat = f.channels.get(shoot.channel_id)
    const denied = await f.react(shoot, 'outsider')
    assert.equal(denied.normal.has(member.id), false)
    assert.equal(chat.permissionOverwrites.cache.has(member.id), false)
    const setup = f.interaction({ command: 'setup', userId: member.id })
    await f.service.handleInteraction(setup)
    assert.equal(setup.modal, undefined)
    assert.match(setup.replies[0].content, /Admin Team/)
    await f.service.handleInteraction(
        f.interaction({ command: 'add', channelId: shoot.channel_id, addUserId: member.id })
    )
    await f.react(shoot, 'outsider')
    assert.ok(allows(chat, member.id, P.SendMessages), 'rejected reaction must not remove a direct invitation')
    await f.service.handleInteraction(
        f.interaction({ command: 'remove', channelId: shoot.channel_id, addUserId: member.id })
    )
    await f.react(shoot, 'outsider')
    assert.equal(chat.permissionOverwrites.cache.has(member.id), false)
    const row = (await f.store.shootParticipants(shoot.id)).find((row) => row.user_id === member.id)
    assert.equal(row.invited, 0)
    assert.equal(row.reacted, 0)
    await f.service.handleInteraction(
        f.interaction({ command: 'add', channelId: shoot.channel_id, addUserId: member.id })
    )
    assert.ok(allows(chat, member.id, P.SendMessages))
})

test('losing eligible roles revokes access, while GM holders retain ordinary reaction eligibility', async (t) => {
    const f = await fixture(t)
    const invited = serviceRequest(f, 'invited')
    const joined = serviceRequest(f, 'joined')
    joined.roles.cache.set(IDS.memberRole, { id: IDS.memberRole })
    const { shoot } = await f.create()
    const chat = f.channels.get(shoot.channel_id)
    await f.react(shoot, 'joined')
    assert.ok(allows(chat, joined.id, P.SendMessages))
    joined.roles.cache.delete(IDS.memberRole)
    await f.service.reconcileAll()
    assert.equal(chat.permissionOverwrites.cache.has(joined.id), false)
    invited.roles.cache.delete(roleId)
    await f.service.reconcileAll()
    assert.equal(chat.permissionOverwrites.cache.has(invited.id), false)
    invited.roles.cache.set(roleId, { id: roleId })
    await f.service.reconcileAll()
    assert.ok(allows(chat, invited.id, P.SendMessages))
    const other = await f.create()
    assert.equal(f.channels.get(other.shoot.channel_id).permissionOverwrites.cache.has(joined.id), false)
})

test('unconfigured/lookalike invite roles and bots cannot be invited', async (t) => {
    const f = await fixture(t)
    serviceRequest(f, 'outsider')
    const { shoot } = await f.create()
    for (const userId of [IDS.outsider, IDS.bot]) {
        if (userId === IDS.outsider) f.config.shootInviteOnlyRoleIds = []
        else {
            f.config.shootInviteOnlyRoleIds = [roleId]
            f.members.get(userId).roles.cache.set(roleId, { id: roleId })
        }
        const add = f.interaction({ command: 'add', channelId: shoot.channel_id, addUserId: userId })
        await f.service.handleInteraction(add)
        assert.match(add.replies.at(-1).content, /cannot be a bot/)
        assert.equal(
            (await f.store.shootParticipants(shoot.id)).some((row) => row.user_id === userId),
            false
        )
    }
})

test('rejected invite-only reactions do not free occupied seats during capacity checks', async (t) => {
    const f = await fixture(t)
    serviceRequest(f, 'invited')
    const { shoot } = await f.create()
    for (let i = 0; i < 96; i++) {
        const id = String(700000000000000000n + BigInt(i))
        f.members.set(id, {
            id,
            user: { id, bot: false },
            roles: { cache: new Collection([[roleId, { id: roleId }]]) },
            permissions: new PermissionsBitField(0n)
        })
        await f.store.inviteShootParticipant(shoot.id, id)
    }
    // Simulate an invited GM reacting, then losing GM while retaining Service Request.
    await f.store.setShootReaction(shoot.id, IDS.invited, true, shoot.announcement_id)
    await f.react(shoot, 'invited', true, { event: false })
    const reaction = await f.react(shoot, 'joined', true, { event: false })
    await f.service.reconcileAll()
    assert.equal(reaction.normal.has(IDS.joined), false)
    assert.equal((await f.service.participantIds(shoot, f.guild)).length, 98)
    const add = f.interaction({ command: 'add', channelId: shoot.channel_id, addUserId: IDS.joined })
    await f.service.handleInteraction(add)
    assert.match(add.replies.at(-1).content, /participant limit/)
    assert.equal(f.errors.length, 0)
})
