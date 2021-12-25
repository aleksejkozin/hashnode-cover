import {DefaultAzureCredential} from '@azure/identity'
import {AppConfigurationClient} from '@azure/app-configuration'
import assert from 'assert'

// APP_CONFIG_NAME is the entry point of all application configuration
assert(process.env.APP_CONFIG_NAME, 'APP_CONFIG_NAME must be set')

// If you run "az login" in a terminal this guy will return your credentials
const credentials = new DefaultAzureCredential()

// If you have env.APP_CONFIG_NAME you have access to the all app configurations
// You're guaranteed to have an access to staging config, but to get prod you need a correct RBAC role
const config = new AppConfigurationClient(
  `https://${process.env.APP_CONFIG_NAME}.azconfig.io`,
  credentials,
)

// Will throw 403 if you have no access, or 404 if no key found
// It takes some time to propagate the access when you give it to a user
// You will continue to have 403 for ~10 minutes after you've gave it to a user
export const getConfig = (
  key: string,
  defaultValue?: string,
): Promise<string> =>
  config
    .getConfigurationSetting({key})
    .then(x => x.value ?? defaultValue)
    .then(x => {
      assert(x, `Config key ${key} not found and no default value provided`)
      return x
    })
