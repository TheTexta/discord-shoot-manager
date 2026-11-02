// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const { required, validEmail, validSnowflake } = require('../shared/validation')
const { IANAZone } = require('luxon')

// Neutral names and legacy TVM names are aliases, never competing sources of truth.
function setting(env, name, legacy, fallback = null) {
    const value = env[name]?.trim() || null
    const old = legacy ? env[legacy]?.trim() || null : null
    if (value && old && value !== old) throw new Error(`Conflicting ${name} and ${legacy}`)
    return value || old || fallback
}

function needed(env, name, legacy) {
    const value = setting(env, name, legacy)
    if (!value) throw new Error(`Missing required ${legacy ? `${legacy} (${name})` : name}`)
    return value
}

function membershipEnabled(env) {
    const value = env.MEMBERSHIP_ENABLED?.trim() || 'true'
    if (!['true', 'false'].includes(value)) throw new Error('MEMBERSHIP_ENABLED must be true or false')
    return value === 'true'
}

function loadDatabasePath(env = process.env) {
    return setting(env, 'DATABASE_PATH', 'TVM_DATABASE_PATH', './config/tvm.db')
}

function loadShootConfig(env = process.env) {
    const names = ['SHOOT_ANNOUNCEMENT_CHANNEL_ID', 'SHOOT_CATEGORY_ID', 'SHOOT_ARCHIVE_CATEGORY_ID']
    const ids = names.map((name) => setting(env, name, `TVM_${name}`))
    if (ids.every((id) => !id)) return null
    if (ids.some((id) => !id))
        throw new Error('Configure all three SHOOT_* (legacy TVM_SHOOT_*) channel/category IDs or leave all unset')
    ids.forEach((id, index) => {
        if (!validSnowflake(id)) throw new Error(`Invalid ${names[index]}`)
    })
    if (new Set(ids).size !== 3) throw new Error('Shoot announcement and category IDs must be distinct')
    return { announcementChannelId: ids[0], categoryId: ids[1], archiveCategoryId: ids[2] }
}

function loadDiscordConfig(env = process.env) {
    const enabled = membershipEnabled(env)
    const config = {
        membershipEnabled: enabled,
        guildId: needed(env, 'DISCORD_GUILD_ID', 'TVM_GUILD_ID'),
        databasePath: loadDatabasePath(env),
        token: required(env, 'DISCORD_BOT_TOKEN'),
        applicationId: required(env, 'DISCORD_APPLICATION_ID'),
        memberRoleId: enabled ? needed(env, 'MEMBER_ROLE_ID', 'TVM_MEMBER_ROLE_ID') : null,
        execRoleId: enabled ? needed(env, 'EXEC_ROLE_ID', 'TVM_EXEC_ROLE_ID') : null,
        adminRoleId: needed(env, 'BOT_ADMIN_ROLE_ID', 'TVM_ADMIN_ROLE_ID'),
        productionAccessRoleId: setting(env, 'PRODUCTION_ACCESS_ROLE_ID', 'TVM_PRODUCTION_ACCESS_ROLE_ID'),
        unverifiedRoleId: enabled ? setting(env, 'UNVERIFIED_ROLE_ID', 'TVM_UNVERIFIED_ROLE_ID') : null,
        alertChannelId: needed(env, 'ADMIN_ALERT_CHANNEL_ID', 'TVM_ADMIN_ALERT_CHANNEL_ID'),
        shootTimezone: env.SHOOT_TIMEZONE?.trim() || 'America/Toronto',
        shoots: loadShootConfig(env)
    }
    for (const key of [
        'applicationId',
        'guildId',
        'adminRoleId',
        'alertChannelId',
        ...(enabled ? ['memberRoleId', 'execRoleId'] : [])
    ]) {
        if (!validSnowflake(config[key])) throw new Error(`Invalid ${key}`)
    }
    const membershipRoles = [config.memberRoleId, config.execRoleId, config.adminRoleId].filter(Boolean)
    if (new Set(membershipRoles).size !== membershipRoles.length)
        throw new Error('Configured role IDs must be distinct')
    if (membershipRoles.includes(config.guildId)) throw new Error('Membership role IDs cannot reference @everyone')
    const eligible = env.SHOOT_ELIGIBLE_ROLE_IDS?.trim()
    config.shootEligibleRoleIds = eligible ? eligible.split(',').map((id) => id.trim()) : enabled ? membershipRoles : []
    if (config.shoots && config.shootEligibleRoleIds.length === 0)
        throw new Error('SHOOT_ELIGIBLE_ROLE_IDS is required for shoot-only deployments')
    if (
        config.shootEligibleRoleIds.some((id) => !validSnowflake(id) || id === config.guildId) ||
        new Set(config.shootEligibleRoleIds).size !== config.shootEligibleRoleIds.length
    )
        throw new Error('Invalid or duplicate SHOOT_ELIGIBLE_ROLE_IDS; @everyone is not allowed')
    if (!IANAZone.isValidZone(config.shootTimezone)) throw new Error('Invalid SHOOT_TIMEZONE; use an IANA timezone')
    if (!enabled && !config.shoots) throw new Error('Enable shoots or membership; both capabilities cannot be disabled')
    if (
        config.unverifiedRoleId &&
        (!validSnowflake(config.unverifiedRoleId) ||
            [config.guildId, config.memberRoleId, config.execRoleId, config.adminRoleId].includes(
                config.unverifiedRoleId
            ) ||
            config.shootEligibleRoleIds.includes(config.unverifiedRoleId))
    ) {
        throw new Error('Invalid or conflicting TVM_UNVERIFIED_ROLE_ID')
    }
    if (config.shoots && !config.productionAccessRoleId)
        throw new Error('Missing required TVM_PRODUCTION_ACCESS_ROLE_ID (PRODUCTION_ACCESS_ROLE_ID)')
    if (
        config.productionAccessRoleId &&
        (!validSnowflake(config.productionAccessRoleId) ||
            [
                config.guildId,
                config.memberRoleId,
                config.execRoleId,
                config.adminRoleId,
                config.unverifiedRoleId,
                ...config.shootEligibleRoleIds
            ].includes(config.productionAccessRoleId))
    ) {
        throw new Error('Invalid or conflicting TVM_PRODUCTION_ACCESS_ROLE_ID')
    }
    return config
}

function loadConfig(env = process.env) {
    const config = loadDiscordConfig(env)
    if (!config.membershipEnabled) return config
    Object.assign(config, loadRosterConfig(env), {
        smtpFrom: required(env, 'SMTP_FROM'),
        resendApiKey: required(env, 'RESEND_API_KEY'),
        smtpHost: env.SMTP_HOST || 'smtp.resend.com',
        smtpPort: Number(env.SMTP_PORT || 465)
    })
    if (!validEmail(config.smtpFrom)) throw new Error('Invalid SMTP_FROM')
    if (config.smtpPort !== 465) throw new Error('The runtime currently requires implicit TLS on SMTP port 465')
    return config
}

function loadRosterConfig(env = process.env) {
    if (!membershipEnabled(env)) throw new Error('Roster maintenance requires MEMBERSHIP_ENABLED=true')
    const guildId = needed(env, 'DISCORD_GUILD_ID', 'TVM_GUILD_ID')
    const codeSecret = required(env, 'VERIFICATION_CODE_SECRET')
    if (!validSnowflake(guildId)) throw new Error('Invalid guildId')
    if (codeSecret.length < 32) throw new Error('VERIFICATION_CODE_SECRET must contain at least 32 characters')
    return { guildId, codeSecret, databasePath: loadDatabasePath(env) }
}

module.exports = { loadConfig, loadDiscordConfig, loadShootConfig, loadRosterConfig, loadDatabasePath }
