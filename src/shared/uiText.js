// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

// Named placeholders keep editable wording separate from application values.
function createTextRenderer(text) {
    return function uiText(key, values = {}) {
        const template = key.split('.').reduce((value, part) => value?.[part], text)
        if (typeof template !== 'string') throw new Error(`Missing UI text: ${key}`)
        return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_match, name) => {
            if (!Object.hasOwn(values, name)) throw new Error(`Missing UI text value: ${key}.${name}`)
            return String(values[name])
        })
    }
}

const fs = require('node:fs')
const defaults = require('../../ui-text.json')
const schema = require('./uiTextSchema.json')

const shootLimits = {
    openForm: 80,
    command: 100,
    setup: 100,
    edit: 100,
    crew: 100,
    add: 100,
    remove: 100,
    close: 100,
    reopen: 100,
    membersOption: 100,
    addUserOption: 100,
    removeUserOption: 100,
    setupTitle: 45,
    editTitle: 45,
    nameLabel: 45,
    dateLabel: 45,
    timeLabel: 45,
    zonedTimeLabel: 45,
    locationLabel: 45,
    joinLabel: 45,
    joinDescription: 100,
    joinDay: 100,
    joinTwoDays: 100,
    joinWeek: 100,
    joinMonth: 100,
    joinNever: 100
}

function validateUiText(candidate = defaults) {
    for (const [key, required] of Object.entries(schema)) {
        const template = key.split('.').reduce((value, part) => value?.[part], candidate)
        if (typeof template !== 'string' || !template.trim()) throw new Error(`Missing UI text: ${key}`)
        const actual = [
            ...new Set([...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((match) => match[1]))
        ].sort()
        if (JSON.stringify(actual) !== JSON.stringify(required))
            throw new Error(`Invalid UI text placeholders: ${key}; expected ${required.join(', ') || 'none'}`)
        const limit = key.startsWith('commands.')
            ? 100
            : key.startsWith('buttons.')
              ? 80
              : key.startsWith('modals.')
                ? 45
                : key.startsWith('shoot.')
                  ? shootLimits[key.slice(6)]
                  : null
        if (limit && template.length > limit) throw new Error(`UI text exceeds ${limit} characters: ${key}`)
    }
    return candidate
}

function loadUiText(filename) {
    const candidate = structuredClone(defaults)
    if (filename) {
        let overrides
        try {
            overrides = JSON.parse(fs.readFileSync(filename, 'utf8'))
        } catch {
            throw new Error('UI_TEXT_PATH must identify a readable JSON override file')
        }
        if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides))
            throw new Error('UI_TEXT_PATH must contain a JSON object')
        for (const [section, values] of Object.entries(overrides)) {
            if (!Object.hasOwn(candidate, section) || !values || typeof values !== 'object' || Array.isArray(values))
                throw new Error(`Invalid UI text section: ${section}`)
            for (const [name, value] of Object.entries(values)) {
                const key = `${section}.${name}`
                if (!Object.hasOwn(schema, key)) throw new Error(`Unknown UI text override: ${key}`)
                candidate[section][name] = value
            }
        }
    }
    return validateUiText(candidate)
}

// One deployment per process. Resolve immutable overrides once, just like the base JSON.
const text = loadUiText(process.env.UI_TEXT_PATH?.trim())
const uiText = createTextRenderer(text)
module.exports = {
    uiText,
    createTextRenderer,
    validateUiText,
    loadUiText,
    unverifiedRoleName: defaults.roles.unverified
}
