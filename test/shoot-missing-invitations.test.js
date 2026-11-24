// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { uiText } = require('../src/shared/uiText')
const { shootMarker } = require('../src/shoots/identifiers')
const { IDS, fixture } = require('./helpers/shoot')

function assertUnavailable(message, shoot) {
    const embed = message.embeds[0].toJSON()
    assert.equal(message.content, uiText('shoot.missingInvitation'))
    assert.equal(embed.description, uiText('shoot.statusMissing'))
    assert.equal(
        embed.fields.find((field) => field.name === uiText('shoot.chatField')).value,
        uiText('shoot.chatUnavailable')
    )
    assert.equal(
        embed.fields.find((field) => field.name === uiText('shoot.joinField')).value,
        uiText('shoot.joinDisabled')
    )
    assert.equal(embed.footer.text, shootMarker(shoot.id, 'invitation'))
    assert.doesNotMatch(JSON.stringify(embed), new RegExp(`<#${shoot.channel_id}>`))
    assert.deepEqual(message.edits.at(-1).allowedMentions, { parse: [] })
}

test('newly missing shoots mark existing invitations unavailable without changing crew or other shoots', async (t) => {
    const f = await fixture(t)
    const { shoot } = await f.create()
    const { shoot: other } = await f.create()
    await f.react(shoot, 'joined')
    const participants = await f.store.shootParticipants(shoot.id)
    const announcement = f.channels.get(IDS.announce)
    const invitation = announcement.messages.cache.get(shoot.announcement_id)
    const otherInvitation = announcement.messages.cache.get(other.announcement_id)
    const otherEdits = otherInvitation.edits.length
    f.channels.delete(shoot.channel_id)
    const channelCount = f.channels.size
    await f.service.reconcileAll()
    assert.equal((await f.store.getShoot(shoot.id, IDS.guild)).status, 'missing')
    await f.service.reconcileAll()
    assertUnavailable(invitation, shoot)
    assert.equal(f.channels.size, channelCount)
    assert.equal(announcement.sends.length, 2)
    assert.deepEqual(await f.store.shootParticipants(shoot.id), participants)
    const current = await f.store.getShoot(shoot.id, IDS.guild)
    for (const key of ['channel_id', 'brief_id', 'announcement_id', 'join_started_at', 'closed_at'])
        assert.equal(current[key], shoot[key])
    assert.equal(current.announcement_deleted_at, null)
    assert.equal((await f.store.getShoot(other.id, IDS.guild)).status, 'open')
    assert.equal(otherInvitation.edits.length, otherEdits)
    const edits = invitation.edits.length
    await f.service.reconcileAll()
    assert.equal(invitation.edits.length, edits, 'unchanged invitations must not be edited every minute')
    await f.react(shoot, 'extra')
    assert.deepEqual(await f.store.shootParticipants(shoot.id), participants)
})

test('startup repairs invitations for already-missing records without republishing or recreating chats', async (t) => {
    const f = await fixture(t)
    const { shoot } = await f.create()
    await f.store.updateShoot(shoot.id, { status: 'missing' })
    f.channels.delete(shoot.channel_id)
    const channelCount = f.channels.size
    await f.restart()
    await f.service.initialize()
    const announcement = f.channels.get(IDS.announce)
    assertUnavailable(announcement.messages.cache.get(shoot.announcement_id), shoot)
    assert.equal(announcement.sends.length, 1)
    assert.equal(f.channels.size, channelCount)
    assert.equal((await f.store.getShoot(shoot.id, IDS.guild)).status, 'missing')
})

test('missing shoots never republish absent invitations, including pending publication and absent saved IDs', async (t) => {
    for (const state of ['deleted', 'pending', 'no-id']) {
        await t.test(state, async (t) => {
            const f = await fixture(t)
            const { shoot } = await f.create()
            const announcement = f.channels.get(IDS.announce)
            announcement.messages.cache.delete(shoot.announcement_id)
            f.channels.delete(shoot.channel_id)
            await f.store.updateShoot(shoot.id, {
                status: 'missing',
                ...(state === 'pending' ? { announcement_republish_pending: 1 } : {}),
                ...(state === 'no-id' ? { announcement_id: null } : {})
            })
            await f.restart()
            await f.service.initialize()
            const current = await f.store.getShoot(shoot.id, IDS.guild)
            assert.equal(current.status, 'missing')
            assert.ok(current.announcement_deleted_at)
            assert.equal(current.announcement_republish_pending, 0)
            assert.equal(announcement.sends.length, 1)
            assert.equal(announcement.messages.cache.size, 0)
            assert.equal(f.channels.has(shoot.channel_id), false)
        })
    }
})

test('unavailable invitation edits retry failures and lost responses without falsely recovering the missing channel', async (t) => {
    for (const applied of [false, true]) {
        await t.test(applied ? 'lost response' : 'permission failure', async (t) => {
            const f = await fixture(t, { reporting: true })
            const { shoot } = await f.create()
            f.channels.delete(shoot.channel_id)
            await f.service.reconcileAll()
            const announcement = f.channels.get(IDS.announce)
            const invitation = announcement.messages.cache.get(shoot.announcement_id)
            const edit = invitation.edit
            invitation.edit = async (payload) => {
                if (applied) await edit(payload)
                throw Object.assign(new Error('edit failed'), { status: 403, code: 50013 })
            }
            await f.service.reconcileAll()
            assert.equal(f.logs.at(-1).operation, 'edit_invitation')
            await f.restart()
            invitation.edit = edit
            await f.service.reconcileAll()
            assertUnavailable(invitation, shoot)
            assert.equal(announcement.sends.length, 1)
            assert.equal((await f.store.getShoot(shoot.id, IDS.guild)).status, 'missing')
            assert.equal(
                f.logs.some((log) => log.event === 'recovered'),
                false
            )
        })
    }
})

test('missing shoots recover an invitation whose republication response was lost, but never send another', async (t) => {
    const f = await fixture(t)
    const { shoot } = await f.create()
    const announcement = f.channels.get(IDS.announce)
    announcement.messages.cache.delete(shoot.announcement_id)
    await f.service.reconcileAll()
    const edit = f.interaction({ command: 'edit', channelId: shoot.channel_id })
    await f.service.handleInteraction(edit)
    announcement.failSendAfter = true
    await f.service.handleInteraction(f.interaction({ customId: edit.modal.custom_id, channelId: shoot.channel_id }))
    assert.equal((await f.store.getShoot(shoot.id, IDS.guild)).announcement_republish_pending, 1)
    const invitation = announcement.messages.cache.first()
    f.channels.delete(shoot.channel_id)
    await f.service.reconcileAll()
    await f.restart()
    await f.service.initialize()
    const current = await f.store.getShoot(shoot.id, IDS.guild)
    assertUnavailable(invitation, shoot)
    assert.equal(current.announcement_id, invitation.id)
    assert.equal(current.announcement_republish_pending, 0)
    assert.equal(current.announcement_deleted_at, null)
    assert.equal(announcement.sends.length, 2)
    assert.equal(announcement.messages.cache.size, 1)
})

test('missing shoots recover an initial invitation whose send response was lost before its ID was saved', async (t) => {
    const f = await fixture(t)
    const announcement = f.channels.get(IDS.announce)
    announcement.failSendAfter = true
    const { shoot } = await f.create()
    assert.equal(shoot.announcement_id, null)
    const invitation = announcement.messages.cache.first()
    f.channels.delete(shoot.channel_id)
    await f.service.reconcileAll()
    await f.restart()
    await f.service.initialize()
    const current = await f.store.getShoot(shoot.id, IDS.guild)
    assertUnavailable(invitation, shoot)
    assert.equal(current.status, 'missing')
    assert.equal(current.announcement_id, invitation.id)
    assert.equal(announcement.sends.length, 1)
    assert.equal(f.channels.has(shoot.channel_id), false)
})

test('missing archived shoots show unavailable until their original 24-hour invitation cleanup is due', async (t) => {
    let now = Date.now()
    const f = await fixture(t, { now: () => now })
    const { shoot } = await f.create()
    await f.service.handleInteraction(f.interaction({ command: 'close', channelId: shoot.channel_id }))
    const closed = await f.store.getShoot(shoot.id, IDS.guild)
    f.channels.delete(shoot.channel_id)
    await f.service.reconcileAll()
    await f.service.reconcileAll()
    const announcement = f.channels.get(IDS.announce)
    assertUnavailable(announcement.messages.cache.get(shoot.announcement_id), shoot)
    assert.equal((await f.store.getShoot(shoot.id, IDS.guild)).closed_at, closed.closed_at)
    now = closed.closed_at + 86400000
    await f.service.reconcileAll()
    assert.equal(announcement.messages.cache.size, 0)
    assert.equal((await f.store.getShoot(shoot.id, IDS.guild)).announcement_deleted_at, now)
    await f.service.initialize()
    assert.equal(announcement.sends.length, 1)
    assert.equal(announcement.messages.cache.size, 0)
})
