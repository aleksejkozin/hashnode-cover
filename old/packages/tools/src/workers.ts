/*
This module will be executed on each application boot
Import here all the workers you want to run
Workers should auto restart on an exception in production
*/

/*
Connecting node instance to applicationinsights
console.log() will be redirected to the cloud for KQL convenient search
Will also collect some node performance information
*/
if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
  let appInsights = require('applicationinsights')
  appInsights
    .setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(false)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI)
    .start()
}

console.log('Starting workers...')

setInterval(() => {
  console.log('Workers are running!')
}, 5000)
