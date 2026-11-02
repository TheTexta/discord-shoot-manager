// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawnSync } = require('node:child_process')
const { DateTime } = require('luxon')
const { PermissionFlagsBits: P } = require('discord.js')
const { loadUiText, createTextRenderer } = require('../src/shared/uiText')
const { parseDetails, modal } = require('../src/shoots/forms')
const { fixture, fields, IDS, allows } = require('./helpers/shoot')

test('deployment text overrides are partial, validated, immutable and loaded by the runtime', (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvm-text-'))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const filename = path.join(dir, 'copy.json')
    fs.writeFileSync(filename, JSON.stringify({ shoot: { setupTitle: 'Studio shoot' } }))
    assert.equal(loadUiText(filename).shoot.setupTitle, 'Studio shoot')
    assert.equal(loadUiText().shoot.setupTitle, require('../ui-text.json').shoot.setupTitle)
    assert.equal(
        createTextRenderer(loadUiText(path.join(__dirname, '../examples/generic-ui-text.json')))('shoot.setupTitle'),
        'Create a shoot'
    )
    const result = spawnSync(
        process.execPath,
        ['-e', "process.stdout.write(require('./src/shared/uiText').uiText('shoot.setupTitle'))"],
        {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, UI_TEXT_PATH: filename },
            encoding: 'utf8'
        }
    )
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, 'Studio shoot')
    fs.writeFileSync(filename, JSON.stringify({ roles: { unverified: 'Awaiting access' } }))
    const discovery = spawnSync(
        process.execPath,
        [
            '-e',
            `
        const assert = require('node:assert/strict');
        const { Collection } = require('discord.js');
        const Manager = require('./src/membership/UnverifiedRoleManager');
        const role = { id: 'existing', name: require('./ui-text.json').roles.unverified,
            permissions: { bitfield: 0n }, managed: false, mentionable: true };
        new Manager('guild', null, []).initialize({ id: 'guild',
            roles: { fetch: async () => new Collection([[role.id, role]]), create: async () => { throw Error('Must not create a role'); } },
            members: { fetchMe: async () => ({ permissions: { has: () => true }, roles: { highest: { comparePositionTo: () => 1 } } }) }
        }).then(found => assert.equal(found.id, 'existing')).catch(error => { console.error(error); process.exitCode = 1; });
    `
        ],
        { cwd: path.join(__dirname, '..'), env: { ...process.env, UI_TEXT_PATH: filename }, encoding: 'utf8' }
    )
    assert.equal(discovery.status, 0, discovery.stderr)
    for (const value of [
        [],
        null,
        { shoot: { unknown: 'bad' } },
        { shoot: { setupTitle: 'x'.repeat(46) } },
        { shoot: { added: 'Missing placeholder' } },
        { unknown: {} },
        { shoot: { setupTitle: null } }
    ]) {
        fs.writeFileSync(filename, JSON.stringify(value))
        assert.throws(() => loadUiText(filename), /UI text|UI_TEXT_PATH/)
    }
    fs.writeFileSync(filename, '{invalid')
    assert.throws(() => loadUiText(filename), /readable JSON/)
})

test('configured timezone parses and edits the same instant, retaining DST rejection and noon defaults', () => {
    const zone = 'Europe/London'
    const details = parseDetails(fields('London shoot', '2026-07-15 13:30'), zone)
    assert.equal(details.call_time, DateTime.fromISO('2026-07-15T12:30:00Z').toMillis())
    const inputs = modal({ id: 'test', revision: 0, ...details }, true, zone).toJSON().components
    assert.equal(inputs[1].component.value, '2026-07-15')
    assert.equal(inputs[2].component.value, '13:30')
    assert.match(inputs[2].label, /Europe\/London/)
    for (const value of ['2026-03-29 01:30', '2026-10-25 01:30'])
        assert.throws(() => parseDetails(fields('DST', value), zone), /Europe\/London/)
    assert.equal(DateTime.fromMillis(parseDetails(fields('Noon', '2026-07-15 '), zone).call_time, { zone }).hour, 12)
    assert.equal(parseDetails(fields('Unscheduled', ''), zone).call_time, null)
})

test('shoot-only lifecycle persists without membership, and explicit roles govern admission and archive access', async (t) => {
    const f = await fixture(t, { membershipEnabled: false })
    Object.assign(f.config, {
        membershipEnabled: false,
        memberRoleId: null,
        execRoleId: null,
        shootEligibleRoleIds: [IDS.memberRole],
        shootTimezone: 'Europe/London'
    })
    assert.equal(f.store.membership, null)
    await f.service.initialize()
    const { shoot } = await f.create(fields('Reusable shoot', '2026-07-15 13:30'))
    assert.equal(shoot.status, 'open')
    assert.equal(shoot.call_time, DateTime.fromISO('2026-07-15T12:30:00Z').toMillis())
    await f.react(shoot, 'joined')
    const channel = f.channels.get(shoot.channel_id)
    assert.equal(allows(channel, IDS.joined, P.ViewChannel), true)
    const outsider = f.members.get(IDS.outsider)
    outsider.roles.cache.set(IDS.productionRole, { id: IDS.productionRole })
    assert.equal(await f.service.eligible(f.guild, outsider.id), false)
    await f.service.handleInteraction(f.interaction({ command: 'close', channelId: shoot.channel_id }))
    assert.equal(allows(channel, IDS.joined, P.SendMessages), false)
    await f.store.sweep()
    await f.restart()
    assert.equal(f.store.membership, null)
    await f.service.reconcileAll()
    assert.equal((await f.store.getShoot(shoot.id, IDS.guild)).status, 'closed')
    await f.service.handleInteraction(f.interaction({ command: 'reopen', channelId: shoot.channel_id }))
    f.members.get(IDS.joined).roles.cache.clear()
    await f.service.reconcileAll()
    assert.equal(allows(channel, IDS.joined, P.ViewChannel), false)
    assert.equal(channel.topic, `TVM shoot ${shoot.id}`)
})
