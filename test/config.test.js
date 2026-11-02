// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { loadConfig, loadRosterConfig } = require('../src/app/config')

const env = {
    DISCORD_BOT_TOKEN: 'test-token',
    DISCORD_APPLICATION_ID: '100000000000000001',
    TVM_GUILD_ID: '100000000000000002',
    TVM_MEMBER_ROLE_ID: '100000000000000003',
    TVM_EXEC_ROLE_ID: '100000000000000004',
    TVM_ADMIN_ROLE_ID: '100000000000000005',
    TVM_ADMIN_ALERT_CHANNEL_ID: '100000000000000006',
    SMTP_FROM: 'verify@example.org',
    RESEND_API_KEY: 'test-api-key',
    VERIFICATION_CODE_SECRET: 's'.repeat(32)
}

test('neutral aliases preserve legacy configuration and reject competing values', () => {
    const aliases = {
        TVM_GUILD_ID: 'DISCORD_GUILD_ID',
        TVM_MEMBER_ROLE_ID: 'MEMBER_ROLE_ID',
        TVM_EXEC_ROLE_ID: 'EXEC_ROLE_ID',
        TVM_ADMIN_ROLE_ID: 'BOT_ADMIN_ROLE_ID',
        TVM_ADMIN_ALERT_CHANNEL_ID: 'ADMIN_ALERT_CHANNEL_ID',
        TVM_DATABASE_PATH: 'DATABASE_PATH',
        TVM_UNVERIFIED_ROLE_ID: 'UNVERIFIED_ROLE_ID',
        TVM_PRODUCTION_ACCESS_ROLE_ID: 'PRODUCTION_ACCESS_ROLE_ID',
        TVM_SHOOT_ANNOUNCEMENT_CHANNEL_ID: 'SHOOT_ANNOUNCEMENT_CHANNEL_ID',
        TVM_SHOOT_CATEGORY_ID: 'SHOOT_CATEGORY_ID',
        TVM_SHOOT_ARCHIVE_CATEGORY_ID: 'SHOOT_ARCHIVE_CATEGORY_ID'
    }
    const legacy = {
        ...env,
        TVM_DATABASE_PATH: './config/test.db',
        TVM_UNVERIFIED_ROLE_ID: '100000000000000020',
        TVM_PRODUCTION_ACCESS_ROLE_ID: '100000000000000021',
        TVM_SHOOT_ANNOUNCEMENT_CHANNEL_ID: '100000000000000022',
        TVM_SHOOT_CATEGORY_ID: '100000000000000023',
        TVM_SHOOT_ARCHIVE_CATEGORY_ID: '100000000000000024'
    }
    const neutral = Object.fromEntries(Object.entries(legacy).map(([key, value]) => [aliases[key] || key, value]))
    assert.deepEqual(loadConfig(neutral), loadConfig(legacy))
    assert.deepEqual(loadConfig({ ...neutral, ...legacy }), loadConfig(legacy))
    for (const [old, name] of Object.entries(aliases)) {
        assert.throws(() => loadConfig({ ...legacy, [name]: `${legacy[old]}x` }), /Conflicting/)
    }
})

test('shoot-only mode requires explicit roles but no mail, roster roles or verification secret', () => {
    const shootOnly = {
        DISCORD_BOT_TOKEN: 'test',
        DISCORD_APPLICATION_ID: env.DISCORD_APPLICATION_ID,
        DISCORD_GUILD_ID: env.TVM_GUILD_ID,
        BOT_ADMIN_ROLE_ID: env.TVM_ADMIN_ROLE_ID,
        ADMIN_ALERT_CHANNEL_ID: env.TVM_ADMIN_ALERT_CHANNEL_ID,
        MEMBERSHIP_ENABLED: 'false',
        SHOOT_ELIGIBLE_ROLE_IDS: env.TVM_MEMBER_ROLE_ID,
        PRODUCTION_ACCESS_ROLE_ID: '100000000000000010',
        SHOOT_ANNOUNCEMENT_CHANNEL_ID: '100000000000000007',
        SHOOT_CATEGORY_ID: '100000000000000008',
        SHOOT_ARCHIVE_CATEGORY_ID: '100000000000000009'
    }
    const value = loadConfig(shootOnly)
    assert.equal(value.membershipEnabled, false)
    assert.equal(value.codeSecret, undefined)
    assert.equal(value.resendApiKey, undefined)
    assert.equal(value.memberRoleId, null)
    assert.deepEqual(value.shootEligibleRoleIds, [env.TVM_MEMBER_ROLE_ID])
    for (const ids of [
        '',
        env.TVM_GUILD_ID,
        `${env.TVM_MEMBER_ROLE_ID},${env.TVM_MEMBER_ROLE_ID}`,
        'bad',
        `${env.TVM_MEMBER_ROLE_ID},`
    ]) {
        assert.throws(() => loadConfig({ ...shootOnly, SHOOT_ELIGIBLE_ROLE_IDS: ids }), /SHOOT_ELIGIBLE_ROLE_IDS/)
    }
    assert.throws(() => loadConfig({ ...shootOnly, MEMBERSHIP_ENABLED: 'yes' }), /true or false/)
    assert.throws(() => loadConfig({ ...shootOnly, MEMBERSHIP_ENABLED: 'true' }), /Missing required/)
    assert.throws(() => loadConfig({ ...env, MEMBERSHIP_ENABLED: 'false' }), /both capabilities/)
    assert.throws(() => loadRosterConfig(shootOnly), /Roster maintenance/)
    assert.equal(loadConfig(env).membershipEnabled, true)
    assert.deepEqual(loadConfig(env).shootEligibleRoleIds, [
        env.TVM_MEMBER_ROLE_ID,
        env.TVM_EXEC_ROLE_ID,
        env.TVM_ADMIN_ROLE_ID
    ])
})

test('deployment timezone is validated without changing the legacy Toronto default', () => {
    assert.equal(loadConfig(env).shootTimezone, 'America/Toronto')
    assert.equal(loadConfig({ ...env, SHOOT_TIMEZONE: 'Europe/London' }).shootTimezone, 'Europe/London')
    assert.throws(() => loadConfig({ ...env, SHOOT_TIMEZONE: 'Not/A_Zone' }), /SHOOT_TIMEZONE/)
})

test('Unverified cannot be an eligible shoot role, even with an explicit admission policy', () => {
    const roleId = '100000000000000020'
    assert.throws(
        () => loadConfig({ ...env, UNVERIFIED_ROLE_ID: roleId, SHOOT_ELIGIBLE_ROLE_IDS: roleId }),
        /conflicting/
    )
})

test('configuration uses injected environment, ignores retired revocation settings, and rejects unsafe IDs', () => {
    for (const value of ['true', 'false', 'yes']) {
        assert.equal(loadConfig({ ...env, TVM_AUTO_ROLE_REVOCATION: value }).autoRoleRevocation, undefined)
    }
    assert.throws(() => loadConfig({ ...env, DISCORD_BOT_TOKEN: ' ' }), /Missing required/)
    assert.throws(() => loadConfig({ ...env, TVM_MEMBER_ROLE_ID: 'invalid' }), /Invalid/)
    assert.throws(() => loadConfig({ ...env, TVM_EXEC_ROLE_ID: env.TVM_MEMBER_ROLE_ID }), /distinct/)
    assert.throws(() => loadConfig({ ...env, TVM_UNVERIFIED_ROLE_ID: env.TVM_ADMIN_ROLE_ID }), /conflicting/)
    assert.throws(() => loadConfig({ ...env, SMTP_FROM: 'invalid' }), /SMTP_FROM/)
    assert.throws(() => loadConfig({ ...env, SMTP_PORT: '587' }), /implicit TLS/)
    assert.throws(() => loadConfig({ ...env, VERIFICATION_CODE_SECRET: 'short' }), /32 characters/)
})

test('production access requires its own role when shoots are enabled', () => {
    const shoots = {
        ...env,
        TVM_SHOOT_ANNOUNCEMENT_CHANNEL_ID: '100000000000000007',
        TVM_SHOOT_CATEGORY_ID: '100000000000000008',
        TVM_SHOOT_ARCHIVE_CATEGORY_ID: '100000000000000009'
    }
    const id = '100000000000000010'
    assert.equal(loadConfig(env).productionAccessRoleId, null)
    assert.throws(() => loadConfig(shoots), /Missing required TVM_PRODUCTION_ACCESS_ROLE_ID/)
    assert.equal(loadConfig({ ...shoots, TVM_PRODUCTION_ACCESS_ROLE_ID: ` ${id} ` }).productionAccessRoleId, id)
    for (const invalid of [
        'bad',
        env.TVM_GUILD_ID,
        env.TVM_MEMBER_ROLE_ID,
        env.TVM_EXEC_ROLE_ID,
        env.TVM_ADMIN_ROLE_ID
    ]) {
        assert.throws(() => loadConfig({ ...shoots, TVM_PRODUCTION_ACCESS_ROLE_ID: invalid }), /conflicting/)
    }
    assert.throws(
        () => loadConfig({ ...shoots, TVM_PRODUCTION_ACCESS_ROLE_ID: id, TVM_UNVERIFIED_ROLE_ID: id }),
        /conflicting TVM_PRODUCTION_ACCESS_ROLE_ID/
    )
})

test('roster maintenance configuration needs only validated database and guild credentials', () => {
    assert.deepEqual(
        loadRosterConfig({
            TVM_GUILD_ID: env.TVM_GUILD_ID,
            VERIFICATION_CODE_SECRET: env.VERIFICATION_CODE_SECRET,
            TVM_DATABASE_PATH: ' ./config/test.db '
        }),
        {
            guildId: env.TVM_GUILD_ID,
            codeSecret: env.VERIFICATION_CODE_SECRET,
            databasePath: './config/test.db'
        }
    )
})

test('local database default is portable and membership roles cannot target everyone', () => {
    assert.equal(loadRosterConfig(env).databasePath, './config/tvm.db')
    for (const key of ['TVM_MEMBER_ROLE_ID', 'TVM_EXEC_ROLE_ID', 'TVM_ADMIN_ROLE_ID']) {
        assert.throws(() => loadConfig({ ...env, [key]: env.TVM_GUILD_ID }), /@everyone/)
    }
})

test('optional local environment loading works with absent files and respects exported variables', (t) => {
    const fs = require('node:fs')
    const os = require('node:os')
    const path = require('node:path')
    const { spawnSync } = require('node:child_process')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvm-env-'))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const run = (env = {}) =>
        spawnSync(
            process.execPath,
            ['--env-file-if-exists=.env.local', '-e', 'process.stdout.write(process.env.TVM_TEST_VALUE || "missing")'],
            { cwd: dir, env, encoding: 'utf8' }
        )
    assert.equal(run().status, 0)
    assert.equal(run().stdout, 'missing')
    fs.writeFileSync(path.join(dir, '.env.local'), 'TVM_TEST_VALUE=file\n')
    assert.equal(run().stdout, 'file')
    assert.equal(run({ TVM_TEST_VALUE: 'exported' }).stdout, 'exported')
})
