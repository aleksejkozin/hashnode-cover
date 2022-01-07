import {WebSiteManagementClient} from '@azure/arm-appservice'
import {promisify} from 'util'
import {exec} from 'child_process'
import {DefaultAzureCredential} from '@azure/identity'

export const f = (x: number) => x

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

export const credentials = new DefaultAzureCredential()

// Escape string. We want protect ourself from an injection
export const e = (x: string) => x.replace(/(["'$`\\])/g, '\\$1')

/*
Run command in terminal and return the result
Will fail if the results is too big
Use it only on commands that return minimum amount of text
Don't forge to escape any variables with e()
*/
export const asyncExec = promisify(exec)

/*
Call this function before any other imports in your project
It will initialise the global environment and logging
*/
export const initEnvironment = () => {
  /*
  Load global environment variables for local development
  In the cloud these variables will be configured by the cloud provider
  But in local development we need to fetch them from pulumi
  */
  try {
    const global =
      require('./global_environment.json')?.globalEnvironmentVariables ?? {}
    process.env = {
      ...global,
      // Local should have higher priority than global
      ...process.env,
    }
  } catch {
    // Do nothing
  }

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
}

/*
When running in a cloud this function will return "true" for only 1 of all the app instances
In other cases it returns "false"
This allows us to run tasks on only 1 of the instance

Needs an Azure Reader access role tho
*/
export const isMainAppInstance = async () => {
  if (
    !process.env.WEBSITE_OWNER_NAME ||
    !process.env.WEBSITE_RESOURCE_GROUP ||
    !process.env.WEBSITE_SITE_NAME
  ) {
    return false
  }

  const subscriptionId = process.env.WEBSITE_OWNER_NAME.split('+')[0]
  const client = new WebSiteManagementClient(credentials, subscriptionId)

  const mainInstance = await client.webApps
    .listInstanceIdentifiers(
      process.env.WEBSITE_RESOURCE_GROUP,
      process.env.WEBSITE_SITE_NAME,
    )
    .next()

  return mainInstance.value.name === process.env.WEBSITE_INSTANCE_ID
}
