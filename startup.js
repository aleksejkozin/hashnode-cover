/*
This module will automatically run on any nodejs start
You can't use monorepo modules here or typescript cuz we don't compile it
*/

// Loading environment variables. All our apps need to have these
const dotenv = require('dotenv')
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env.global' })

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
