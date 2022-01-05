/*
This module will automatically run on an app start
You can't use monorepo modules here or typescript cuz we don't compile it
*/

/*
1. Load global environment variables for local development
In the cloud these variables will be configured by the cloud provider
But in local development we need to fetch them from pulumi
*/
try {
  const data = require('./packages/cover-infrastructure/global_environment.json')
  const globalEnvironmentVariables = Object.entries(
    data?.globalEnvironmentVariables ?? {}
  )
  globalEnvironmentVariables.forEach(([k, v]) => {
    // We don't want to overwrite existing environment variables
    if (!(k in process.env)) {
      process.env[k] = String(v)
    }
  })
} catch {}

// 2. Load local environment variables
const dotenv = require('dotenv')
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

// 3. Initialize logging. All our apps should send logs to app insights
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
