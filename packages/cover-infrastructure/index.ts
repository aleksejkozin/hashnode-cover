/*
# Infrastructure as Code
If you run this file with Pulumi it will automatically create resources in:
- Azure cloud
- Auth0 cloud
- MongoDB cloud
All the settings are 1 to 1 to UI of the corresponding clouds

Benefits:
- You store all infrastructure configs in one place
- You can use JS to describe your infrastructure, eg, loops/conditions/comments
- You can work on infrastructure with git, eg, code reviews, merge requests
- You can have dev/prod deployments that will be identical, cuz you run them from code
- You can even have deployment for every git branch

# Azure vs AWS vs Google
I use Azure cloud as the main cloud, but you can switch to AWS or Google, the idea is the same
Each cloud has unique resources, but they are all alike:
- Scalable run docker containers
- Allow to serve large amounts of data
- Provide queues
- Etc
Configs will vary, but the ideas are the same

# Warning: NEVER terminate Pulumi unexpectedly
No CTRL+C, no computer reboot. You may end up in an inconsistent state.
This state could be only resolved by a manual intervention.

At some point you WILL end up in an inconsistent state tho.
Use these manual commands to fix your state:
- pulumi stack -u
- pulumi state delete *urn*

# You need to know what are Pulumi's Output<T> Input<T>
Before you begin please read https://www.pulumi.com/docs/intro/concepts/inputs-outputs/
Use interpolate to build ALL strings in this file
interpolate() - will resolve Outputs/Inputs and Promises and join a string.
*/

import * as resources from '@pulumi/azure-native/resources'
import * as storage from '@pulumi/azure-native/storage'
import * as web from '@pulumi/azure-native/web'
import * as appconfiguration from '@pulumi/azure-native/appconfiguration'
import * as insights from '@pulumi/azure-native/insights'
import * as path from 'path'
import * as docker from '@pulumi/docker'
import * as pulumi from '@pulumi/pulumi'
import { all, interpolate } from '@pulumi/pulumi'
import * as azuread from '@pulumi/azuread'
import * as authorization from '@pulumi/azure-native/authorization'
import * as auth0 from '@pulumi/auth0'
import * as random from '@pulumi/random'

// Constants
const cfg = new pulumi.Config()
const stack = pulumi.getStack()
// All Pulumi resources will have this prefix for human-convenience
const prefix = stack === 'prod' ? 'hashnode' : `hn${stack}`

// -----------------------------
// --- EXTERNAL DEPENDENCIES ---
// -----------------------------

/*
Here you put resources that you don't want to manage with Pulumi
Common reasons:
- Pulumi doesn't support the resource
- The resource is mission critical and you don't want to accidentally delete it
- The resource costs significant money and you don't want duplicate it multiple times
*/

// Here we will store all out containers, but we need an admin access
const dockerRegistry = {
  server: cfg.require('DOCKER_REGISTRY_SERVER'),
  username: cfg.requireSecret('DOCKER_REGISTRY_USERNAME'),
  password: cfg.requireSecret('DOCKER_REGISTRY_PASSWORD'),
}

/*
Azure App Service Plan. Costs money. Will create manually.
The hardware that will run our applications. Can spawn hundreds of Docker nodes inside.
*/
const appServicePlanId =
  '/subscriptions/1b9fad02-07cd-4610-8b55-37fa112217d6/resourceGroups/devgroup4cb7cbb8/providers/Microsoft.Web/serverfarms/devservice37a9ba7d'

// ----------------
// --- SECURITY ---
// ----------------

/*
You can add users into this Azure AD group and they will have an access to run the app
To run the app a user needs a set of permissions like:
- reading app configs
- reading queues
The Azure AD group has all these permissions set,
You only need to manually add your devs there so they could run the app locally
*/
const workers = new azuread.Group(
  `${prefix}workers`,
  {
    displayName: `${prefix}workers`,
    owners: [
      // The owner is who run this script
      azuread.getClientConfig({}).then((current) => current.objectId),
    ],
    // This group is for IAM access
    securityEnabled: true,
  },
  // It's a hassle add devs back, slow auth propagation, so, let's not delete the group
  { protect: true }
)

// -----------------------
// --- BASIC RESOURCES ---
// -----------------------

/*
The root resource group
It's like a folder that holds all your Azure cloud resources
*/
const resourceGroup = new resources.ResourceGroup(`${prefix}group`)
// workers should be able to read app configurations of resourceGroup
new authorization.RoleAssignment(`${prefix}allowReadConfigs`, {
  // For this resource
  scope: resourceGroup.id,
  // Assign a role for this group
  principalId: workers.id,
  principalType: 'Group',
  /*
  roleDefinitionId could be found in Azure UI, it's a constant for the role
  App Configuration Data Reader
  Allows read access to App Configuration data.
  */
  roleDefinitionId:
    '/providers/Microsoft.Authorization/roleDefinitions/516239f1-63e1-4d78-a4de-a74fb236a071',
})

/*
Here we store all our app configs
This way local app instances and cloud can share the same configs
*/
const appConfig = new appconfiguration.ConfigurationStore(
  `${prefix}config`,
  {
    resourceGroupName: resourceGroup.name,
    sku: {
      name: 'Standard',
    },
  },
  /*
  All our instances should have a stable access point to config, so let's block any delete attempt
  This will allow to have stable APP_CONFIG_NAME across all the system
  If you change appConfig you need to manually update .env
  */
  { protect: true }
)
const setConfig = (keyValueName: string, value: pulumi.Input<string>) =>
  new appconfiguration.KeyValue(prefix + keyValueName + 'config', {
    resourceGroupName: resourceGroup.name,
    configStoreName: appConfig.name,
    keyValueName: keyValueName,
    value: value,
  })

/*
Will collect all our logs and provide KQL search interface to them
Handy for debugging
*/
const appInsights = new insights.Component(`${prefix}insights`, {
  resourceGroupName: resourceGroup.name,
  // All these configurations are a mystery for me
  flowType: 'Bluefield',
  requestSource: 'rest',
  kind: 'web',
  applicationType: insights.ApplicationType.Web,
})

/*
Here we will store documents, images, and queues
Basically an infinite cloud data storage
*/
const storageAccount = new storage.StorageAccount(`${prefix}sa`, {
  resourceGroupName: resourceGroup.name,
  sku: {
    // Standard Locally Redundant Storage. You can bump it for more redundancy
    name: storage.SkuName.Standard_LRS,
  },
  // Hot has cheap reads, but expensive store
  // Cool has expensive reads, but cheap store
  // We rarely read images but store them indefinitely, so let's be cool
  accessTier: storage.AccessTier.Cool,
  // StorageV2 supports queues
  kind: storage.Kind.StorageV2,
})
setConfig('storageAccount', storageAccount.name)

// Container is like a folder for your data. Here we will store articles' cover images
new storage.BlobContainer(
  `${prefix}blobimages`,
  {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
    containerName: 'articleimages',
    // we don't need a public access for our images
    publicAccess: 'None',
  },
  // We have valuable client data there, so let's block any delete attempt
  { protect: true }
)

/*
MongoDB instance
// TODO: add
*/

// ------------------------
// --- THE MONOLITH APP ---
// ------------------------

// Should be user-friendly for prod cuz will be a part of domain
const appName = prefix

/*
Build and publish the Docker container image
The image will be several gigabytes, it way take 10-20 minutes to push it to the registry
*/
const image = new docker.Image(`${appName}image`, {
  imageName: interpolate`${dockerRegistry.server}/${appName}`,
  build: {
    target: 'runner',
    context: path.join(__dirname, '../../'),
    dockerfile: path.join(__dirname, '../../Dockerfile'),
    // It seems cacheFrom is super slow, skipping it
    // cacheFrom: { stages: ['dependencies', 'builder', 'runner'] },
  },
  registry: dockerRegistry,
})
// We can now run our Docker container with AppServicePlan, eg, create an WebApp
const app = new web.WebApp(appName, {
  resourceGroupName: resourceGroup.name,
  serverFarmId: appServicePlanId,
  httpsOnly: true,
  kind: 'app',
  identity: {
    // This will push credentials as environment variables to the container
    type: 'SystemAssigned',
  },
  siteConfig: {
    // Could be enabled starting from B1 AppServicePlan
    alwaysOn: true,
    // Use docker image
    linuxFxVersion: interpolate`DOCKER|${image.imageName}`,
    httpLoggingEnabled: true,
    detailedErrorLoggingEnabled: true,
    logsDirectorySizeLimit: 35, //in MB
    // Let's kill an instance if it doesn't respond to HTTP requests
    autoHealEnabled: true,
    autoHealRules: {
      actions: {
        actionType: 'Recycle',
      },
      triggers: {
        // If we get 3 20sec requests in 300sec, then Recycle the instance
        slowRequests: {
          count: 3,
          timeTaken: '00:00:20',
          timeInterval: '00:05:00',
          path: '/',
        },
      },
    },
  },
})
// Our app will be run on these endpoints
export const appUrl = interpolate`https://${app.defaultHostName}`
const localUrl = 'http://localhost:3000'
const appUrls = [appUrl, localUrl]

// Our app should have access to our cloud resources
new azuread.GroupMember(appName + 'isworker', {
  groupObjectId: workers.id,
  memberObjectId: app.identity.apply((x) => x!.principalId),
})

/*
Configure auth
We will use https://auth0.com/ as an OIDC provider
*/
const auth0Application = new auth0.Client(appName + 'auth0', {
  appType: 'regular_web',
  name: `Hashnode Cover App ${prefix}`,
  description: `Is an automatically managed auth account, please, don't edit manually`,
  jwtConfiguration: {
    /*
    Auth0 recommends RS256 https://community.auth0.com/t/rs256-vs-hs256-jwt-signing-algorithms/58609
    NextJs uses RS256
    */
    alg: 'RS256',
  },
  webOrigins: appUrls,
  allowedOrigins: appUrls,
  allowedLogoutUrls: appUrls.map((x) => interpolate`${x}/api/auth/logout`),
  callbacks: appUrls.map((x) => interpolate`${x}/api/auth/callback`),
})

/*
Configure Environment Variables
Part of the variables available only on the cloud
Part of the variables available on the cloud and locally
*/
// Cloud Apps, local Docker containers, etc, everyone will have these environment variables
const globalEnvironmentVariables = {
  AUTH0_ISSUER_BASE_URL: interpolate`https://${auth0.config.domain}`,
  AUTH0_CLIENT_ID: auth0Application.clientId,
  AUTH0_CLIENT_SECRET: auth0Application.clientSecret,
}
// We need to save environment variables for the local app runs
all(globalEnvironmentVariables).apply((env) =>
  setConfig('env', JSON.stringify(env))
)
new web.WebAppApplicationSettings(appName + 'settings', {
  resourceGroupName: resourceGroup.name,
  name: app.name,
  properties: {
    // App Insights config
    APPLICATIONINSIGHTS_CONNECTION_STRING: interpolate`InstrumentationKey=${appInsights.instrumentationKey}`,
    APPINSIGHTS_INSTRUMENTATIONKEY: appInsights.instrumentationKey,
    ApplicationInsightsAgent_EXTENSION_VERSION: '~2',
    // Do not persist or share /home/ directory between instances
    WEBSITES_ENABLE_APP_SERVICE_STORAGE: 'false',
    // linuxFxVersion use this docker connection to pull images
    DOCKER_REGISTRY_SERVER_URL: interpolate`https://${dockerRegistry.server}`,
    DOCKER_REGISTRY_SERVER_USERNAME: dockerRegistry.username,
    DOCKER_REGISTRY_SERVER_PASSWORD: dockerRegistry.password,
    // Continues deployment. Will automatically pull new images
    DOCKER_ENABLE_CI: 'true',
    // Our application exposed port. We run NextJs on it
    WEBSITES_PORT: '3000',
    // Used to get access to the application configuration
    APP_CONFIG_NAME: appConfig.name,
    // We need to bake this here so common variables update would restart the container
    ...globalEnvironmentVariables,
    // These AUTH0_* configs are specific to this Docker instance and should not be shared outside
    AUTH0_BASE_URL: appUrl,
    AUTH0_SECRET: new random.RandomPassword(appName + 'auth0secret', {
      length: 256,
    }).result,
  },
})

/*
What a ride!
This file is the hardest part of our app
Creating and configuring cloud resources is a major pinpoint and hassle of devs
*/
