// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const {
    REST,
    Routes,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js')
const { assertPrivateAlertChannel } = require('../shared/channelPermissions')
const { HealthReporter } = require('../infrastructure/HealthReporter')
const { createAdminAlerter } = require('../infrastructure/AdminAlerts')
const { uiText, validateUiText } = require('../shared/uiText')
const { canManageBot } = require('../shared/permissions')
const { AdminOperationError, withAdminOperation } = require('../shared/AdminOperation')
const UnverifiedRoleManager = require('../membership/UnverifiedRoleManager')
const { ShootService } = require('../shoots/ShootService')
const { buildCommands } = require('./commands')
const { createMembershipService } = require('../membership/MembershipService')
const { createVerificationService } = require('../membership/VerificationService')
const { createRosterCommands, previewButtons } = require('../membership/RosterCommands')
const { roleKinds, configuredRoleIds } = require('../membership/roles')
const { normalizeEmail, validEmail } = require('../shared/validation')
const { modal: shootModal } = require('../shoots/forms')
const { emailModal, codeModal, codeRow } = require('../membership/verificationUi')

function createApp({
    config,
    store,
    mail,
    client,
    unverifiedRoles,
    shoots: shootService,
    rest,
    logger = console,
    onFatal = () => {},
    shutdownTimeoutMs = 25000
}) {
    if (!config || !store || !client || (config.membershipEnabled !== false && !mail))
        throw new Error('Application dependencies are required')
    const membershipEnabled = config.membershipEnabled !== false
    validateUiText()
    // Build all interactive components now, including optional shoots, before connecting.
    if (membershipEnabled) {
        emailModal().toJSON()
        codeModal().toJSON()
        codeRow().toJSON()
        previewButtons('validation', true).toJSON()
    }
    buildCommands(Boolean(config.shoots), membershipEnabled)
    shootModal(
        { id: 'validation', revision: 0, name: '', location: '', call_time: null, join_period: 'day' },
        false,
        config.shootTimezone
    ).toJSON()
    shootModal(
        { id: 'validation', revision: 0, name: 'Shoot', location: 'Studio', call_time: null, join_period: 'day' },
        true,
        config.shootTimezone
    ).toJSON()
    let state = 'starting'
    let resolveReady, rejectReady
    const readiness = new Promise((resolve, reject) => {
        resolveReady = resolve
        rejectReady = reject
    })
    // Shutdown or an initialization event can precede start().
    readiness.catch(() => {})
    let startPromise
    let stopping = false
    let shutdownPromise
    let healthReporter
    let alertReady = false
    let membershipTimer
    const active = new Set()
    const listeners = []
    function track(work) {
        const job = Promise.resolve().then(work)
        active.add(job)
        job.then(
            () => active.delete(job),
            () => active.delete(job)
        )
        return job
    }
    function listen(event, handler, once = false) {
        const listener = (...args) => {
            if (stopping) return Promise.resolve()
            const job = track(() => handler(...args))
            job.catch((error) => logger.error(`[TVM] ${event} failed:`, error?.message || error))
            return job
        }
        client[once ? 'once' : 'on'](event, listener)
        listeners.push([event, listener])
    }
    const alertAdmins = createAdminAlerter({
        isReady: () => alertReady,
        logger,
        send: async (message) => {
            const channel = await client.channels.fetch(config.alertChannelId)
            if (!channel?.isTextBased()) return false
            await channel.send({ content: uiText('alerts.message', { message }), allowedMentions: { parse: [] } })
            return true
        }
    })
    let membershipQueue = Promise.resolve()
    function withMembershipLock(work) {
        const next = membershipQueue.then(work)
        membershipQueue = next.catch(() => {})
        return next
    }

    const commands = buildCommands(Boolean(config.shoots), membershipEnabled)
    const shoots =
        shootService ||
        new ShootService({
            client,
            store: store.shoots || store,
            config,
            alertAdmins,
            logger
        })
    const privateReply = (interaction, content, components = []) => interaction.editReply({ content, components })
    const roleIds = membershipEnabled ? configuredRoleIds(config) : {}
    if (membershipEnabled)
        unverifiedRoles ||= new UnverifiedRoleManager(config.guildId, config.unverifiedRoleId, [
            ...new Set([...Object.values(roleIds), ...(config.shootEligibleRoleIds || [])])
        ])
    let unverifiedReady = false
    const membership = membershipEnabled
        ? createMembershipService({
              config,
              store: store.membership || store,
              unverifiedRoles,
              alertAdmins,
              logger,
              withMembershipLock
          })
        : null
    const { roleNames, reconcile } = membership || {}
    const { sendVerification, checkCode } = membershipEnabled
        ? createVerificationService({
              config,
              store: store.membership || store,
              mail,
              withMembershipLock,
              membership,
              privateReply,
              alertAdmins,
              logger
          })
        : {}
    const healthStatus = () => ({
        state,
        connected: state === 'ready' && (client.isReady?.() ?? true),
        membershipEnabled,
        membershipLastSuccessAt: membership?.status().lastSuccessAt ?? null,
        shootsEnabled: Boolean(config.shoots),
        shootLastSuccessAt: shoots.lastSuccessAt ?? null
    })
    function scheduleReconciliation(guild) {
        return track(async () => {
            try {
                return membershipEnabled ? await reconcile(guild) : null
            } finally {
                if (!stopping) await shoots.reconcileAll?.()
            }
        })
    }
    const {
        uploadRoster,
        handleRoster,
        handleUploadButton,
        stop: stopRosterCommands
    } = membershipEnabled
        ? createRosterCommands({
              config,
              store: store.membership || store,
              withMembershipLock,
              membership,
              privateReply,
              unverifiedRoles,
              alertAdmins,
              scheduleReconciliation,
              healthStatus
          })
        : {}

    listen(
        'clientReady',
        async () => {
            try {
                await store.ready
                if (stopping) return
                await store.sweep()
                if (stopping) return
                rest ||= new REST({ version: '10' }).setToken(config.token)
                const guild = await client.guilds.fetch(config.guildId)
                const neededRoles = [
                    ...new Set([
                        ...(membershipEnabled ? roleKinds.map((kind) => roleIds[kind]) : [config.adminRoleId]),
                        ...(config.shoots ? config.shootEligibleRoleIds || [] : [])
                    ])
                ]
                const roles = await Promise.all(neededRoles.map((id) => guild.roles.fetch(id)))
                const botMember = await guild.members.fetchMe()
                if (
                    roles.some(
                        (role) =>
                            !role ||
                            role.id === guild.id ||
                            (membershipEnabled &&
                                Object.values(roleIds).includes(role.id) &&
                                (role.managed || botMember.roles.highest.position <= role.position))
                    ) ||
                    (membershipEnabled && !botMember.permissions.has(PermissionFlagsBits.ManageRoles))
                ) {
                    throw new Error(
                        membershipEnabled
                            ? 'Bot cannot manage all configured roles; check its permissions and role position'
                            : 'Configured shoot or management roles are missing or unsafe'
                    )
                }
                const alertChannel = await client.channels.fetch(config.alertChannelId)
                if (
                    !alertChannel?.isTextBased() ||
                    alertChannel.guildId !== guild.id ||
                    !alertChannel
                        .permissionsFor(botMember)
                        ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
                ) {
                    throw new Error('Bot cannot send to its private administrator alert channel')
                }
                const allRoles = await guild.roles.fetch()
                await assertPrivateAlertChannel({
                    channel: {
                        type: alertChannel.type,
                        guild_id: alertChannel.guildId,
                        permission_overwrites: [...alertChannel.permissionOverwrites.cache.values()]
                    },
                    guild: { id: guild.id, owner_id: guild.ownerId },
                    roles: [...allRoles.values()],
                    botId: botMember.id,
                    adminRoleId: config.adminRoleId,
                    fetchMember: async (id) => {
                        const member = await guild.members.fetch({ user: id, force: true }).catch((error) => {
                            if (error.code === 10007) return null
                            throw error
                        })
                        return member ? { roles: [...member.roles.cache.keys()] } : null
                    }
                })
                alertReady = true
                if (stopping) return
                if (membershipEnabled) {
                    const unverifiedRole = await unverifiedRoles.initialize(guild)
                    if (stopping) return
                    if (config.productionAccessRoleId === unverifiedRole.id) {
                        throw new Error('TVM_PRODUCTION_ACCESS_ROLE_ID must be separate from Unverified')
                    }
                    if (config.shootEligibleRoleIds?.includes(unverifiedRole.id)) {
                        throw new Error('SHOOT_ELIGIBLE_ROLE_IDS must not include Unverified')
                    }
                    unverifiedReady = true
                    const result = await reconcile(guild)
                    if (stopping) return
                    logger.log(
                        `[TVM] Unverified role ${unverifiedRole.id}: added ${result.unverified.added}, removed ${result.unverified.removed}, failed ${result.unverified.failed}`
                    )
                    if (result.revoked) logger.log(`[TVM] Reconciled ${result.revoked} removed claims`)
                }
                await shoots.initialize()
                if (stopping) return
                await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), {
                    body: commands
                })
                if (stopping) return
                state = 'ready'
                if (config.databasePath) {
                    healthReporter = new HealthReporter(config.databasePath, healthStatus, logger)
                    await healthReporter.start()
                    if (stopping) {
                        await healthReporter.stop()
                        return
                    }
                }
                resolveReady()
                logger.log('[TVM] Bot ready; guild commands registered')
                membershipTimer = setInterval(() => {
                    if (stopping) return
                    track(() => store.sweep()).catch((error) =>
                        logger.error('[TVM] Cleanup failed:', error?.message || error)
                    )
                    scheduleReconciliation(guild).catch((error) =>
                        logger.error('[TVM] Scheduled role reconciliation failed:', error?.message || error)
                    )
                }, 3600000).unref()
            } catch (error) {
                rejectReady(error)
                if (stopping) return
                logger.error('[TVM] Startup failed:', error?.message || error)
                await alertAdmins(uiText('alerts.startupFailed'))
                onFatal(error)
            }
        },
        true
    )

    async function syncUnverifiedMember(member) {
        if (state !== 'ready' || !unverifiedReady || member.guild.id !== config.guildId) return
        try {
            await withMembershipLock(() => unverifiedRoles.syncMember(member))
        } catch (error) {
            logger.error('[TVM] Member Unverified role sync failed:', error?.message || error)
            await alertAdmins(uiText('alerts.unverifiedFailed'))
        }
    }

    listen('guildMemberAdd', async (member) => {
        if (state !== 'ready' || member.guild.id !== config.guildId || member.user.bot) return
        if (membershipEnabled) await membership.syncUser(member.guild, member.id)
        await shoots.reconcileAll?.()
    })
    const accessRoles = new Set(
        [
            ...(config.shootEligibleRoleIds || [config.memberRoleId, config.execRoleId]),
            config.adminRoleId,
            config.productionAccessRoleId
        ].filter(Boolean)
    )
    const hasRole = (member, id) => member?.roles?.cache?.has(id) || member?.roles?.includes?.(id) || false
    listen('guildMemberUpdate', async (oldMember, member) => {
        await syncUnverifiedMember(member)
        if (state !== 'ready' || member.guild.id !== config.guildId || !config.shoots) return
        const administrator = (value) => value?.permissions?.has?.(PermissionFlagsBits.Administrator) || false
        if (
            [...accessRoles].some((id) => hasRole(oldMember, id) !== hasRole(member, id)) ||
            administrator(oldMember) !== administrator(member)
        )
            await shoots.reconcileAll?.()
    })
    listen('guildMemberRemove', (member) => {
        if (state === 'ready' && member.guild.id === config.guildId) return shoots.reconcileAll?.()
    })
    listen('messageReactionAdd', (reaction, user) => state === 'ready' && shoots.onReaction(reaction, user))
    listen('messageReactionRemove', (reaction, user) => state === 'ready' && shoots.onReaction(reaction, user))
    listen('messageReactionRemoveAll', (message) => state === 'ready' && shoots.onReactionClear(message))
    listen(
        'messageReactionRemoveEmoji',
        (reaction) => state === 'ready' && shoots.onReactionClear(reaction.message, reaction.emoji)
    )
    async function reconnect() {
        if (state !== 'ready' || stopping) return
        await scheduleReconciliation(await client.guilds.fetch(config.guildId))
    }
    listen('shardResume', reconnect)
    listen('shardReady', reconnect)
    listen('shardError', (error) => logger.error('[TVM] Discord connection failed:', error.message))

    listen('interactionCreate', async (interaction) => {
        if (interaction.guildId !== config.guildId) return
        try {
            if (interaction.isChatInputCommand() && interaction.commandName === 'source') {
                await interaction.reply({ content: uiText('verification.source'), flags: MessageFlags.Ephemeral })
                return
            }
            if (state !== 'ready') {
                await interaction.reply({ content: uiText('verification.starting'), flags: MessageFlags.Ephemeral })
                return
            }
            const membershipInteraction =
                (interaction.isChatInputCommand() &&
                    ['verify', 'upload', 'roster', 'postverify', 'testmail'].includes(interaction.commandName)) ||
                ['tvm:verify', 'tvm:open-code', 'tvm:email', 'tvm:code'].includes(interaction.customId) ||
                interaction.customId?.startsWith('tvm:roster:')
            if (!membershipEnabled && membershipInteraction) {
                await interaction.reply({ content: uiText('verification.disabled'), flags: MessageFlags.Ephemeral })
                return
            }
            if (await shoots.handleInteraction(interaction)) return
            if (interaction.isButton()) {
                if (await handleUploadButton?.(interaction)) return
                if (interaction.customId === 'tvm:verify') return await interaction.showModal(emailModal())
                if (interaction.customId === 'tvm:open-code') return await interaction.showModal(codeModal())
                return
            }
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'tvm:email') return await sendVerification(interaction)
                if (interaction.customId === 'tvm:code') return await checkCode(interaction)
                return
            }
            if (!interaction.isChatInputCommand()) return
            if (interaction.commandName === 'verify') return await interaction.showModal(emailModal())
            if (!canManageBot(interaction, config.adminRoleId)) {
                await interaction.reply({ content: uiText('admin.permissionRequired'), flags: MessageFlags.Ephemeral })
                return
            }
            if (interaction.commandName === 'upload') return await uploadRoster(interaction)
            if (interaction.commandName === 'roster') return await handleRoster(interaction)
            if (interaction.commandName === 'postverify') {
                return await withAdminOperation(async (operation) => {
                    await interaction.reply({ content: uiText('verification.posting'), flags: MessageFlags.Ephemeral })
                    await interaction.channel.send({
                        content: uiText('verification.post', {
                            memberRole: roleNames.member,
                            execRole: roleNames.exec,
                            adminRole: roleNames.admin
                        }),
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('tvm:verify')
                                    .setLabel(uiText('buttons.verify'))
                                    .setStyle(ButtonStyle.Success)
                            )
                        ]
                    })
                    operation.completed()
                    await operation.confirm(uiText('admin.verificationPosted'), (content) =>
                        privateReply(interaction, content)
                    )
                })
            }
            if (interaction.commandName === 'testmail') {
                return await withAdminOperation(async (operation) => {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
                    const email = normalizeEmail(interaction.options.getString('email'))
                    if (!validEmail(email)) throw new Error(uiText('errors.invalidDestination'))
                    await mail.sendMail({
                        fromName: uiText('email.fromName'),
                        to: email,
                        subject: uiText('email.testSubject'),
                        text: uiText('email.testBody')
                    })
                    operation.completed()
                    await operation.confirm(uiText('admin.testmailSent'), (content) =>
                        privateReply(interaction, content)
                    )
                })
            }
        } catch (error) {
            logger.error('[TVM] Interaction failed:', error?.message || error)
            const adminOperation =
                interaction.customId?.startsWith('tvm:roster:') ||
                (interaction.isChatInputCommand() &&
                    interaction.commandName !== 'verify' &&
                    interaction.commandName !== 'source')
            if (!adminOperation) await alertAdmins(uiText('alerts.interactionFailed'))
            const message =
                error instanceof AdminOperationError
                    ? error.message
                    : adminOperation
                      ? uiText('admin.operationFailed', { error: String(error?.message || error).slice(0, 1500) })
                      : uiText('verification.failed')
            if (interaction.deferred || interaction.replied)
                await interaction.editReply({ content: message, components: [] }).catch(() => {})
            else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {})
        }
    })

    function start() {
        if (stopping) return Promise.reject(new Error('Application is stopping'))
        startPromise ||= track(async () => {
            await client.login(config.token)
            await readiness
        })
        return startPromise
    }

    function shutdown() {
        if (shutdownPromise) return shutdownPromise
        stopping = true
        state = 'stopping'
        rejectReady(new Error('Application is stopping'))
        clearInterval(membershipTimer)
        shoots.stop()
        membership?.stop()
        stopRosterCommands?.()
        for (const [event, listener] of listeners) client.off(event, listener)
        let timer
        const drain = (async () => {
            try {
                await Promise.allSettled([...active])
                await membershipQueue
                await membership?.drain()
                await healthReporter?.stop()
                await shoots.drain()
                await mail?.close?.()
                await store.close()
            } finally {
                await client.destroy()
            }
        })()
        const deadline = new Promise((_, reject) => {
            timer = setTimeout(() => {
                mail?.close?.()
                client.destroy()
                reject(new Error(`Shutdown exceeded ${shutdownTimeoutMs} ms`))
            }, shutdownTimeoutMs)
        })
        shutdownPromise = Promise.race([drain, deadline]).finally(() => clearTimeout(timer))
        return shutdownPromise
    }

    return { commands, start, shutdown, healthStatus }
}

module.exports = { createApp }
