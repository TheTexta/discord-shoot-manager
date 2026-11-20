// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { MessageFlags } = require('discord.js')
const { createMembershipInteractionHandler } = require('../src/membership/MembershipInteractions')
const { AdminOperationError } = require('../src/shared/AdminOperation')
const { uiText } = require('../src/shared/uiText')

function interaction({ commandName, customId, type = 'command', admin = false } = {}) {
    return {
        commandName,
        customId,
        user: { bot: false },
        member: { roles: admin ? ['admin'] : [] },
        isChatInputCommand: () => type === 'command',
        isButton: () => type === 'button',
        isModalSubmit: () => type === 'modal',
        replies: [],
        async reply(payload) {
            this.replies.push(payload)
        },
        async showModal(modal) {
            this.modal = modal.toJSON()
        }
    }
}

test('membership handler declines unrelated interactions and handles every disabled entry without dependencies', async () => {
    const handle = createMembershipInteractionHandler({ config: { membershipEnabled: false } })
    assert.equal(await handle(interaction({ commandName: 'shoot' })), false)
    assert.equal(await handle(interaction({ customId: 'other', type: 'button' })), false)
    for (const commandName of ['verify', 'upload', 'roster', 'postverify', 'testmail']) {
        const value = interaction({ commandName })
        assert.equal(await handle(value), true)
        assert.deepEqual(value.replies, [{ content: uiText('verification.disabled'), flags: MessageFlags.Ephemeral }])
    }
    for (const customId of ['tvm:verify', 'tvm:open-code', 'tvm:email', 'tvm:code', 'tvm:roster:confirm:token']) {
        const value = interaction({ customId, type: 'button' })
        assert.equal(await handle(value), true)
        assert.equal(value.replies[0].content, uiText('verification.disabled'))
    }
})

test('verification routing delegates acknowledgement and delivery entirely to VerificationService', async () => {
    const calls = []
    const handle = createMembershipInteractionHandler({
        config: {},
        sendVerification: async (value) => calls.push(['email', value]),
        checkCode: async (value) => calls.push(['code', value]),
        handleUploadButton: async () => false
    })
    for (const [customId, type] of [
        ['tvm:verify', 'button'],
        ['tvm:open-code', 'button']
    ]) {
        const value = interaction({ customId, type })
        assert.equal(await handle(value), true)
        assert.ok(value.modal)
    }
    for (const [customId, kind] of [
        ['tvm:email', 'email'],
        ['tvm:code', 'code']
    ]) {
        const value = interaction({ customId, type: 'modal' })
        assert.equal(await handle(value), true)
        assert.deepEqual(calls.at(-1), [kind, value])
        assert.deepEqual(value.replies, [])
    }
})

test('admin command routing checks authorization before roster, publication, or mail work', async () => {
    const calls = []
    const handle = createMembershipInteractionHandler({
        config: { adminRoleId: 'admin' },
        uploadRoster: async () => calls.push('upload'),
        handleRoster: async () => calls.push('roster'),
        handleUploadButton: async (value) => {
            calls.push(value.customId)
            return true
        }
    })
    for (const commandName of ['upload', 'roster', 'postverify', 'testmail']) {
        const value = interaction({ commandName })
        assert.equal(await handle(value), true)
        assert.equal(value.replies[0].content, uiText('admin.permissionRequired'))
    }
    assert.deepEqual(calls, [])
    for (const commandName of ['upload', 'roster'])
        assert.equal(await handle(interaction({ commandName, admin: true })), true)
    await handle(interaction({ customId: 'tvm:roster:confirm:token', type: 'button' }))
    assert.deepEqual(calls, ['upload', 'roster', 'tvm:roster:confirm:token'])
})

test('accepted test mail preserves completed outcome when confirmation fails', async () => {
    const sent = []
    const handle = createMembershipInteractionHandler({
        config: { adminRoleId: 'admin' },
        mail: { sendMail: async (payload) => sent.push(payload) },
        privateReply: async () => {
            throw new Error('reply lost')
        }
    })
    const value = interaction({ commandName: 'testmail', admin: true })
    value.deferReply = async () => {}
    value.options = { getString: () => 'CONTROLLED@example.org' }
    await assert.rejects(handle(value), (error) => error instanceof AdminOperationError)
    assert.equal(sent.length, 1)
    assert.equal(sent[0].to, 'controlled@example.org')
})

test('verification publication remains an authorized admin operation and preserves acceptance on reply loss', async () => {
    const posts = []
    const handle = createMembershipInteractionHandler({
        config: { adminRoleId: 'admin' },
        roleNames: { member: 'Member', exec: 'Executive', admin: 'Admin' },
        privateReply: async () => {
            throw new Error('reply lost')
        }
    })
    const value = interaction({ commandName: 'postverify', admin: true })
    value.channel = { send: async (payload) => posts.push(payload) }
    await assert.rejects(handle(value), (error) => error instanceof AdminOperationError)
    assert.equal(posts.length, 1)
    assert.equal(posts[0].components[0].toJSON().components[0].custom_id, 'tvm:verify')
    assert.equal(value.replies[0].flags, MessageFlags.Ephemeral)
})
