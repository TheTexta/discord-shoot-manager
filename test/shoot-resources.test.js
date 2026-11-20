// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { Collection, Embed } = require('discord.js')
const ShootResources = require('../src/shoots/ShootResources')
const { uiText } = require('../src/shared/uiText')

function fixture() {
    let now = 1000000
    const shoot = {
        id: 'shoot',
        guild_id: 'guild',
        organizer_id: 'owner',
        channel_id: 'channel',
        name: 'Film',
        location: 'Studio',
        status: 'open',
        join_period: 'day',
        join_started_at: now,
        call_date_text: 'next Friday',
        call_time_text: 'around 6 pm',
        call_time: null
    }
    const messages = new Collection()
    const sends = []
    const deleted = []
    const channel = {
        messages: {
            fetch: async ({ message }) => {
                if (!message) return messages
                if (!messages.has(message)) throw Object.assign(new Error('missing'), { code: 10008 })
                return messages.get(message)
            },
            delete: async (id) => {
                deleted.push(id)
                messages.delete(id)
            }
        },
        send: async (payload) => {
            sends.push(payload)
            const message = {
                id: String(sends.length),
                content: payload.content,
                embeds: payload.embeds.map((embed) => new Embed(embed.toJSON())),
                author: { id: 'bot' },
                pinned: false,
                pin: async () => {
                    message.pinned = true
                },
                edit: async (payload) =>
                    Object.assign(message, payload, {
                        embeds: payload.embeds.map((embed) => new Embed(embed.toJSON()))
                    })
            }
            messages.set(message.id, message)
            return message
        }
    }
    const resources = new ShootResources({
        client: { user: { id: 'bot' }, guilds: { fetch: async () => ({ channels: { fetch: async () => channel } }) } },
        store: {
            updateShoot: async (_id, values) => Object.assign(shoot, values),
            getShoot: async () => ({ ...shoot }),
            shootParticipants: async () => [{ user_id: 'crew', invited: 1 }]
        },
        settings: { announcementChannelId: 'announcement' },
        operation: (_name, work) => work(),
        updateContext: () => {},
        now: () => now
    })
    return {
        resources,
        shoot,
        channel,
        messages,
        sends,
        deleted,
        setNow: (value) => {
            now = value
        }
    }
}

test('narrow resource interface owns ID mapping and uses caller member lookup and injected render time', async () => {
    const f = fixture()
    const lookedUp = []
    await f.resources.ensureBrief(f.channel, f.shoot, {
        closed: false,
        members: async (id) => {
            lookedUp.push(id)
            return { displayName: 'Crew' }
        }
    })
    assert.equal(f.shoot.brief_id, '1')
    assert.equal(f.shoot.announcement_id, undefined)
    assert.deepEqual(lookedUp, ['crew'])
    assert.equal(f.messages.get('1').pinned, true)
    f.setNow(f.shoot.join_started_at + 86400000 - 1)
    await f.resources.ensureInvitation(f.channel, f.shoot, { closed: false })
    assert.equal(f.shoot.announcement_id, '2')
    assert.equal(f.messages.get('2').content, uiText('shoot.invitation'))
    assert.match(f.sends[0].embeds[0].toJSON().fields[0].value, /next Friday/)
    f.setNow(f.shoot.join_started_at + 86400000)
    await f.resources.ensureInvitation(f.channel, f.shoot, { closed: false })
    assert.equal(f.messages.get('2').content, uiText('shoot.expiredInvitation'))
})

test('resource cleanup starts at exactly 24 hours and cannot republish a closed invitation afterward', async () => {
    const f = fixture()
    await f.resources.ensureInvitation(f.channel, f.shoot, { closed: false })
    Object.assign(f.shoot, { status: 'closed', closed_at: 1000000 })
    f.setNow(f.shoot.closed_at + 86400000 - 1)
    await f.resources.cleanupAnnouncement(f.shoot)
    assert.deepEqual(f.deleted, [])
    f.setNow(f.shoot.closed_at + 86400000)
    await f.resources.cleanupAnnouncement(f.shoot)
    assert.deepEqual(f.deleted, ['1'])
    assert.equal(f.shoot.announcement_deleted_at, f.shoot.closed_at + 86400000)
    assert.equal(await f.resources.ensureInvitation(f.channel, f.shoot, { closed: true, republish: true }), null)
    assert.equal(f.sends.length, 1)
})

test('resource deletion tombstones and legacy close-time fallback use injected time', async () => {
    const f = fixture()
    f.shoot.announcement_id = 'deleted'
    await f.resources.ensureInvitation(f.channel, f.shoot, { closed: false })
    assert.equal(f.shoot.announcement_deleted_at, 1000000)
    assert.equal(f.sends.length, 0)
    Object.assign(f.shoot, { announcement_deleted_at: null, status: 'closed' })
    await f.resources.cleanupAnnouncement(f.shoot)
    assert.equal(f.shoot.closed_at, 1000000)
    assert.deepEqual(f.deleted, [])
})

test('narrow invitation interface recovers an ambiguous republish using persisted intent and durable marker', async () => {
    const f = fixture()
    Object.assign(f.shoot, { announcement_id: 'deleted', announcement_deleted_at: 900000 })
    const send = f.channel.send
    f.channel.send = async (payload) => {
        await send(payload)
        throw new Error('response lost')
    }
    await assert.rejects(f.resources.ensureInvitation(f.channel, f.shoot, { closed: false, republish: true }))
    assert.equal(f.shoot.announcement_republish_pending, 1)
    assert.equal(f.shoot.announcement_id, 'deleted')
    f.channel.send = send
    await f.resources.ensureInvitation(f.channel, f.shoot, { closed: false })
    assert.equal(f.sends.length, 1)
    assert.equal(f.shoot.announcement_id, '1')
    assert.equal(f.shoot.announcement_deleted_at, null)
    assert.equal(f.shoot.announcement_republish_pending, 0)
    assert.equal(f.sends[0].enforceNonce, true)
    assert.equal(f.sends[0].nonce.length, 24)
})

test('legacy cleanup prefers the actual edited message timestamp rather than the injected clock', async () => {
    const f = fixture()
    await f.resources.ensureInvitation(f.channel, f.shoot, { closed: false })
    Object.assign(f.messages.get('1'), { editedTimestamp: 800000, createdTimestamp: 700000 })
    f.shoot.status = 'closed'
    await f.resources.cleanupAnnouncement(f.shoot)
    assert.equal(f.shoot.closed_at, 800000)
    assert.deepEqual(f.deleted, [])
})
