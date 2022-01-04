/*
Use @hashnode-cover/common to store code that will be useful in multiple packages.
*/

export * from './mongo'

// Common

import { exec } from 'child_process'
import { promisify } from 'util'
import { WebSiteManagementClient } from '@azure/arm-appservice'
import { DefaultAzureCredential } from '@azure/identity'

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

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

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
      process.env.WEBSITE_SITE_NAME
    )
    .next()

  return mainInstance.value.name === process.env.WEBSITE_INSTANCE_ID
}
