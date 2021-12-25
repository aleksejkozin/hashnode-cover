/*
Use @hashnode-cover/common to store code that will be useful in multiple packages.
*/

import {exec} from 'child_process'
import {promisify} from 'util'

export * from './config'

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
When running in the Azure cloud this function will return "true" for only 1 of all the app instances
In other cases it returns "false"
This allows us to run tasks on only 1 of instance
*/
export const isMainApplicationInstance = async (): Promise<boolean> => {
  const group = process.env.WEBSITE_RESOURCE_GROUP ?? ''
  const webAppName = process.env.WEBSITE_SITE_NAME ?? ''

  if (!group || !webAppName) {
    return false
  }

  const {stdout} = await asyncExec(
    `az webapp list-instances -g "${e(group)}" -n "${e(webAppName)}"`,
  )

  const ids = JSON.parse(stdout).map((x: any) => x.name)
  return ids.length > 0 && ids[0] === process.env.WEBSITE_INSTANCE_ID
}
