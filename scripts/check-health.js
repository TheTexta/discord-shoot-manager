// SPDX-License-Identifier: AGPL-3.0-or-later
'use strict'
const fs = require('node:fs')
const { healthPath, checkHealth } = require('../src/infrastructure/HealthReporter')
const { loadDatabasePath } = require('../src/app/config')
try {
    checkHealth(JSON.parse(fs.readFileSync(healthPath(loadDatabasePath()), 'utf8')))
    console.log('Bot health check passed')
} catch (error) {
    console.error(error.message)
    process.exitCode = 1
}
