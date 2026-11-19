// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { escapeMarkdown } = require('discord.js')
const { IDS, fields, fixture } = require('./helpers/shoot')
const { parseDetails, modal } = require('../src/shoots/forms')
const { renderShoot } = require('../src/shoots/render')

test('literal schedules round-trip through setup, edit, messages, restart and archive', async (t) => {
    const f = await fixture(t)
    const date = 'next Friday / TBD'
    const time = 'around 6 pm — after class'
    let { shoot } = await f.create(fields('Film', { date, time }))
    assert.equal(shoot.call_time, null)
    assert.equal(shoot.call_date_text, date)
    assert.equal(shoot.call_time_text, time)
    const started = shoot.join_started_at
    const edit = f.interaction({ command: 'edit', channelId: shoot.channel_id })
    await f.service.handleInteraction(edit)
    const inputs = edit.modal.components.map((label) => label.component)
    assert.equal(inputs[1].value, date)
    assert.equal(inputs[2].value, time)
    assert.equal(inputs[1].max_length, 200)
    assert.equal(inputs[2].max_length, 200)
    const submit = f.interaction({ customId: edit.modal.custom_id, channelId: shoot.channel_id })
    const updated = { date: '**sometime** @everyone', time: `after <@${IDS.joined}>, about 18:00` }
    submit.fields = fields('Film', updated)
    await f.service.handleInteraction(submit)
    await f.restart()
    await f.service.reconcileAll()
    shoot = await f.store.getShoot(shoot.id, IDS.guild)
    assert.equal(shoot.call_date_text, updated.date)
    assert.equal(shoot.call_time_text, updated.time)
    assert.equal(shoot.join_started_at, started)
    for (const [channelId, messageId] of [
        [shoot.channel_id, shoot.brief_id],
        [IDS.announce, shoot.announcement_id]
    ]) {
        const message = f.channels.get(channelId).messages.cache.get(messageId)
        assert.equal(message.embeds[0].fields[0].value, escapeMarkdown(`${updated.date}\n${updated.time}`))
        assert.deepEqual(message.edits.at(-1).allowedMentions, { parse: [] })
    }
    await f.service.handleInteraction(f.interaction({ command: 'close', channelId: shoot.channel_id }))
    await f.service.handleInteraction(f.interaction({ command: 'reopen', channelId: shoot.channel_id }))
    assert.equal((await f.store.getShoot(shoot.id, IDS.guild)).call_date_text, updated.date)
    assert.equal(f.errors.length, 0)
})

test('date-only, time-only and blank schedules render without invented information', () => {
    for (const [date, time, expected] of [
        ['Friday', '', 'Friday'],
        ['', 'after lunch', 'after lunch'],
        ['', '', 'Unscheduled']
    ]) {
        const details = parseDetails(fields('Film', { date, time }))
        assert.equal(details.call_date_text, date)
        assert.equal(details.call_time_text, time)
        assert.equal(details.call_time, null)
        assert.equal(
            renderShoot({ id: 'test', ...details }, 'brief', false).embeds[0].toJSON().fields[0].value,
            expected
        )
    }
    for (const key of ['date', 'time']) {
        assert.throws(() => parseDetails(fields('Film', { [key]: 'x'.repeat(201) })), /Enter/)
        const details = parseDetails(fields('Film', { [key]: '*'.repeat(200) }))
        assert.ok(
            renderShoot({ id: 'test', ...details }, 'brief', false).embeds[0].toJSON().fields[0].value.length <= 1024
        )
    }
})

test('legacy timestamp migration preserves instants and unrelated edits, then permits literal edits and clearing', async (t) => {
    const f = await fixture(t)
    const { shoot } = await f.create()
    const call_time = Date.parse('2026-10-15T17:30:47.123Z')
    await f.store.updateShoot(shoot.id, { call_time, call_date_text: null, call_time_text: null })
    await f.store._locked(() =>
        f.store._exec(`
        ALTER TABLE shoots DROP COLUMN call_date_text;
        ALTER TABLE shoots DROP COLUMN call_time_text;
        DELETE FROM tvm_schema_migrations WHERE version = 8;
    `)
    )
    await f.restart()
    await f.restart()
    let legacy = await f.store.getShoot(shoot.id, IDS.guild)
    assert.equal(legacy.call_time, call_time)
    assert.equal(legacy.call_date_text, null)
    assert.equal(legacy.call_time_text, null)
    await f.service.reconcileAll()
    const callValue = () =>
        f.channels.get(shoot.channel_id).messages.cache.get(shoot.brief_id).embeds[0].fields[0].value
    assert.equal(callValue(), `<t:${Math.floor(call_time / 1000)}:F>`)
    const inputs = modal(legacy, true).toJSON().components
    assert.equal(inputs[1].component.value, '2026-10-15')
    assert.equal(inputs[2].component.value, '13:30')
    for (const schedule of [
        { date: '2026-10-15', time: '13:30' },
        { date: 'next Friday', time: '6-ish' },
        { date: '', time: '' }
    ]) {
        const edit = f.interaction({ command: 'edit', channelId: shoot.channel_id })
        await f.service.handleInteraction(edit)
        const submit = f.interaction({ customId: edit.modal.custom_id, channelId: shoot.channel_id })
        submit.fields = fields('Renamed film', schedule, 'New studio')
        await f.service.handleInteraction(submit)
        legacy = await f.store.getShoot(shoot.id, IDS.guild)
        if (schedule.date === '2026-10-15') {
            assert.equal(legacy.call_time, call_time)
            assert.equal(legacy.call_date_text, null)
            assert.equal(callValue(), `<t:${Math.floor(call_time / 1000)}:F>`)
        } else {
            assert.equal(legacy.call_time, null)
            assert.equal(legacy.call_date_text, schedule.date)
            assert.equal(legacy.call_time_text, schedule.time)
            assert.equal(callValue(), schedule.date ? 'next Friday\n6-ish' : 'Unscheduled')
        }
    }
    assert.equal(f.errors.length, 0)
})
