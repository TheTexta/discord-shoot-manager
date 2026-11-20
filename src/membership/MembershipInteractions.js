// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js')
const { uiText } = require('../shared/uiText')
const { canManageBot } = require('../shared/permissions')
const { withAdminOperation } = require('../shared/AdminOperation')
const { normalizeEmail, validEmail } = require('../shared/validation')
const { emailModal, codeModal } = require('./verificationUi')

function createMembershipInteractionHandler({
    config,
    mail,
    roleNames,
    sendVerification,
    checkCode,
    uploadRoster,
    handleRoster,
    handleUploadButton,
    privateReply
}) {
    const membershipEnabled = config.membershipEnabled !== false
    async function dispatch(interaction) {
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
                await operation.confirm(uiText('admin.testmailSent'), (content) => privateReply(interaction, content))
            })
        }
    }
    return async (interaction) => {
        const membershipInteraction =
            (interaction.isChatInputCommand() &&
                ['verify', 'upload', 'roster', 'postverify', 'testmail'].includes(interaction.commandName)) ||
            ['tvm:verify', 'tvm:open-code', 'tvm:email', 'tvm:code'].includes(interaction.customId) ||
            interaction.customId?.startsWith('tvm:roster:')
        if (!membershipInteraction) return false
        if (!membershipEnabled) {
            await interaction.reply({ content: uiText('verification.disabled'), flags: MessageFlags.Ephemeral })
            return true
        }
        await dispatch(interaction)
        return true
    }
}

module.exports = { createMembershipInteractionHandler }
