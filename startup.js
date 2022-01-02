/*
This module will automatically run on any nodejs start
You can't use monorepo modules here or typescript cuz we don't compile it
*/

// Load global environment variables
try {
  const data = require('./packages/cover-infrastructure/output.json')
  const globalEnvironmentVariables = Object.entries(
    data?.globalEnvironmentVariables ?? {}
  )
  globalEnvironmentVariables.map(([k, v]) => {
    process.env[k] = v
  })
} catch {
  // do nothing
}

// Load local environment variables
const dotenv = require('dotenv')
const { writeFileSync } = require('fs')
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

// Initialize logging. All our apps should send logs to app insights
if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
  const appInsights = require('applicationinsights')
  appInsights
    .setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectConsole(true, true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI)
    .start()
}
