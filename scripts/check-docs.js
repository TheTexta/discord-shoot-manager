// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'

const fs = require('node:fs')
const path = require('node:path')

function prose(markdown) {
    let fence = null
    const lines = []
    for (const line of markdown.split('\n')) {
        const marker = line.match(/^\s*(`{3,}|~{3,})/)
        if (marker) {
            if (!fence) fence = marker[1]
            else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null
        } else if (!fence) lines.push(line)
    }
    return { text: lines.join('\n'), unclosedFence: Boolean(fence) }
}

function headingAnchors(text) {
    const counts = new Map()
    const anchors = new Set()
    for (const [, heading] of text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
        const slug = heading
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
            .replace(/\s/g, '-')
        const count = counts.get(slug) || 0
        counts.set(slug, count + 1)
        anchors.add(count ? `${slug}-${count}` : slug)
    }
    return anchors
}

function activeDocuments(root) {
    return [
        'README.md',
        'CONTRIBUTING.md',
        'SECURITY.md',
        'plan.md',
        ...fs
            .readdirSync(path.join(root, 'docs'), { recursive: true })
            .filter((name) => name.endsWith('.md') && !/^(upstream|archive)[/\\]/.test(name))
            .map((name) => path.join('docs', name))
    ]
}

function checkDocuments(root, files = activeDocuments(root)) {
    const errors = []
    for (const filename of files) {
        const source = fs.readFileSync(path.join(root, filename), 'utf8')
        const { text, unclosedFence } = prose(source)
        if (!/^#\s+\S/.test(text.trimStart()) || [...text.matchAll(/^#\s+/gm)].length !== 1)
            errors.push(`${filename}: use one top-level title at the start`)
        if (unclosedFence) errors.push(`${filename}: unclosed code fence`)
        // Active docs use ordinary inline links; external destinations are never fetched.
        for (const [, raw] of text.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
            if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) continue
            let destination
            try {
                destination = decodeURIComponent(raw.replace(/^<|>$/g, ''))
            } catch {
                errors.push(`${filename}: invalid encoded link ${raw}`)
                continue
            }
            const [link, anchor] = destination.split('#')
            const target = path.resolve(root, path.dirname(filename), link || path.basename(filename))
            const relative = path.relative(root, target)
            if (relative.startsWith('..') || !fs.existsSync(target)) {
                errors.push(`${filename}: missing or outside-repository link ${raw}`)
                continue
            }
            if (anchor && target.endsWith('.md')) {
                const anchors = headingAnchors(prose(fs.readFileSync(target, 'utf8')).text)
                if (!anchors.has(anchor)) errors.push(`${filename}: missing heading anchor ${raw}`)
            }
        }
    }
    return { files: files.length, errors }
}

if (require.main === module) {
    const result = checkDocuments(path.join(__dirname, '..'))
    for (const error of result.errors) console.error(error)
    console.log(
        `Documentation check: ${result.files} active files, ${result.errors.length} errors (upstream/archive excluded)`
    )
    if (result.errors.length) process.exitCode = 1
}

module.exports = { checkDocuments, headingAnchors }
