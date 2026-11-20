// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { fixture, IDS } = require('./helpers/shoot')
const ShootInputError = require('../src/shoots/ShootInputError')

test('injected clock expires cached forms at exactly thirty minutes and prunes expired entries', async (t) => {
    let now = 1000000
    const f = await fixture(t, { now: () => now })
    const setup = f.interaction({ command: 'setup' })
    await f.service.handleInteraction(setup)
    const token = [...f.service.forms.keys()][0]
    const click = f.interaction({ customId: `tvm:shoot:form:${token}` })
    now += 30 * 60000 - 1
    assert.ok(f.service.openForm(click))
    now++
    assert.throws(() => f.service.openForm(click), ShootInputError)
    await f.service.prepareForm(f.interaction(), { id: 'another' })
    assert.equal(f.service.forms.has(token), false)
})

test('draft submission rejects the exact expiry boundary using injected time', async (t) => {
    let now = Date.now()
    const f = await fixture(t, { now: () => now })
    const setup = f.interaction({ command: 'setup' })
    await f.service.handleInteraction(setup)
    const id = setup.modal.custom_id.split(':')[3]
    const draft = await f.store.getShoot(id, IDS.guild)
    now = draft.created_at + 30 * 60000
    await assert.rejects(f.service.submitModal(f.interaction({ customId: setup.modal.custom_id })), ShootInputError)
    assert.equal((await f.store.getShoot(id, IDS.guild)).status, 'draft')
    now--
    await f.service.submitModal(f.interaction({ customId: setup.modal.custom_id }))
    assert.equal((await f.store.getShoot(id, IDS.guild)).status, 'open')
})

test('injected admission and close clocks preserve exact deadlines and original publication timestamps', async (t) => {
    let now = Date.now()
    const f = await fixture(t, { now: () => now })
    const { id, shoot } = await f.create()
    const announcement = f.channels.get(IDS.announce).messages.cache.get(shoot.announcement_id)
    assert.equal(shoot.join_started_at, announcement.createdTimestamp)
    now = shoot.join_started_at + 86400000 - 1
    await f.react(shoot, 'joined', true, { event: false })
    await f.service.reconcileReactions(shoot)
    assert.equal((await f.store.shootParticipants(id)).find((row) => row.user_id === IDS.joined).reacted, 1)
    now++
    await f.react(shoot, 'extra', true, { event: false })
    await f.service.reconcileReactions(shoot)
    assert.equal(
        (await f.store.shootParticipants(id)).some((row) => row.user_id === IDS.extra && row.reacted),
        false
    )
    await f.service.handleInteraction(f.interaction({ command: 'close', channelId: shoot.channel_id }))
    assert.equal((await f.store.getShoot(id, IDS.guild)).closed_at, now)
    await f.service.reconcileAll()
    assert.equal(f.service.lastSuccessAt, now)
})
