/*
This module will be executed on each application boot
Import here all the workers you want to run
*/

/*
Connecting node instance to applicationinsights
console.log() will be redirected to the cloud for KQL convenient search
Will also collect some node performance information
*/
import * as appInsights from 'applicationinsights'

if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
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
