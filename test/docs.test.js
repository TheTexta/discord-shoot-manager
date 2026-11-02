// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { checkDocuments, headingAnchors } = require('../scripts/check-docs')
const { buildCommands } = require('../src/app/commands')

test('active documentation links and basic Markdown conventions pass', () => {
    const result = checkDocuments(path.join(__dirname, '..'))
    assert.ok(result.files >= 20)
    assert.deepEqual(result.errors, [])
})

test('documentation checker rejects missing links, missing anchors, invalid titles and unclosed fences', (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvm-docs-'))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    fs.writeFileSync(path.join(dir, 'target.md'), '# Target\n\n## A heading\n')
    const filename = path.join(dir, 'source.md')
    fs.writeFileSync(filename, '# Source\n\n[valid](target.md#a-heading)\n[external](https://example.org/)\n')
    assert.deepEqual(checkDocuments(dir, ['source.md']).errors, [])
    for (const [source, expected] of [
        ['# Source\n[bad](missing.md)', /missing or outside/],
        ['# Source\n[bad](target.md#missing)', /missing heading/],
        ['## No title\n', /top-level title/],
        ['# Source\n```js\n', /unclosed code fence/]
    ]) {
        fs.writeFileSync(filename, source)
        assert.match(checkDocuments(dir, ['source.md']).errors.join('\n'), expected)
    }
    assert.deepEqual([...headingAnchors('# Title\n## Repeat\n## Repeat')], ['title', 'repeat', 'repeat-1'])
})

test('configuration examples and registered commands are covered by their reference pages', () => {
    const root = path.join(__dirname, '..')
    const config = fs.readFileSync(path.join(root, 'docs/reference/configuration.md'), 'utf8')
    for (const filename of ['.env.example', 'examples/shoot-only.env.example']) {
        const example = fs.readFileSync(path.join(root, filename), 'utf8')
        for (const [, name] of example.matchAll(/^([A-Z][A-Z_\d]*)=/gm))
            assert.ok(config.includes(`\`${name}\``), `${filename}: ${name} is documented`)
    }
    const commands = fs.readFileSync(path.join(root, 'docs/reference/commands.md'), 'utf8')
    for (const command of buildCommands(true)) {
        const subcommands = (command.options || []).filter((option) => option.type === 1)
        for (const name of subcommands.length
            ? subcommands.map((option) => `${command.name} ${option.name}`)
            : [command.name])
            assert.ok(commands.includes(`\`/${name}\``), `${name} is documented`)
    }
})
