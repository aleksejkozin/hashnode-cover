/*
# Infrastructure as Code

The idea:
- Usually, you have a lot of configurations in different clouds done manually via UI
- You can put all these configs in one file and deploy it from here
- This way you can reproduce and reason about the configs

If you run this file with Pulumi it will automatically create resources in:
- Azure cloud
- Auth0 cloud
- MongoDB cloud
- etc
All the settings are 1 to 1 to UI of the corresponding clouds

Benefits:
- You store all infrastructure configs in one place
- You can copy the infrastructure as text files
- You can use JS to describe your infrastructure, eg, loops/conditions/comments
- You can work on infrastructure with git, eg, code reviews, merge requests
- You can have dev/prod deployments that will be identical, cuz you run them from code
- You can even have deployment for every git branch

# Initial Run
The first Pulumi run should be done locally. It will create:
- ARM_SUBSCRIPTION_ID
- ARM_TENANT_ID
- ARM_CLIENT_ID
- ARM_CLIENT_SECRET
You should use these credentials to give your CI pipeline access to Azure

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

// All Pulumi resources will have this prefix for human-convenience
const p = cfg.require('prefix')

// -----------------------------
// --- EXTERNAL DEPENDENCIES ---
// -----------------------------

/*
Pulumi.*.yaml

Here you put resources that you don't want to manage with Pulumi
Common reasons:
- Security. Some resources could be created only by admins
- Pulumi doesn't support the resource
- The resource is the mission critical, and you don't want to accidentally delete it
- The resource costs significant money, and you don't want duplicate it multiple times

Azure pre-requirements:
- You should have access to Azure portal
- You should be an owner of the target resource group where you want to deploy resources
- You should have an app service plan created
*/

// Here we will store all out containers, but we need an admin access
const dockerRegistry = {
  server: cfg.require('DOCKER_REGISTRY_SERVER'),
  username: cfg.requireSecret('DOCKER_REGISTRY_USERNAME'),
  password: cfg.requireSecret('DOCKER_REGISTRY_PASSWORD'),
}

// CI Service Principal should have owner access to this group
const resourceGroup = resources.getResourceGroupOutput({
  resourceGroupName: cfg.require('resourceGroupName'),
})

// ----------------
// --- SECURITY ---
// ----------------

/*
CI service principal
Will be used by GitHub to manage resources

Starting June 30th of 2022 will be deprecated
You will need to migrate to MSAL
https://developer.microsoft.com/en-us/graph/graph-explorer
*/
const ciApplication = new azuread.Application(`${p}ciapp`, {
  displayName: `${p}ciapp`,
})
/*
You can attach roles to service principals

Unfortunately, we need to wait for the service principal to be created
This is a Terraform bug, azuread uses Terraform under the hood

The first run of the Pulumi will guarantee to fail cuz we need to wait for the service principal to be created
After it would created the bug will be fixed
*/
const ciServicePrincipal = new azuread.ServicePrincipal(`${p}cisp`, {
  applicationId: ciApplication.applicationId,
})
// CI Service should have full access to the resource group
new authorization.RoleAssignment(`${p}ciisowner`, {
  scope: resourceGroup.id,
  principalId: ciServicePrincipal.id,
  principalType: 'ServicePrincipal',
  /*
  Owner
  Grants full access to manage all resources, including the ability to assign roles in Azure RBAC.
  */
  roleDefinitionId:
    '/providers/Microsoft.Authorization/roleDefinitions/8e3af657-a8ff-443c-a75c-2fe8c4bcb635',
})
const ciPassword = new azuread.ApplicationPassword(`${p}ciapppass`, {
  applicationObjectId: ciApplication.objectId,
})
// Create these variables in GitHub secrets, this way GitHub Pulumi will have access to Azure
export const ARM_SUBSCRIPTION_ID = authorization
  .getClientConfig()
  .then((x) => x.subscriptionId)
export const ARM_TENANT_ID = authorization
  .getClientConfig()
  .then((x) => x.tenantId)
export const ARM_CLIENT_ID = ciApplication.applicationId
export const ARM_CLIENT_SECRET = ciPassword.value

/*
You can add users into this Azure AD group and they will have an access to run the app
To run the app a user needs a set of permissions like:
- reading app configs
- reading queues
The Azure AD group has all these permissions set,
You only need to manually add your devs there so they could run the app locally
*/
const workers = new azuread.Group(`${p}workers`, {
  displayName: `${p}workers`,
  owners: ciServicePrincipal.owners.apply((x) => [...x, ciServicePrincipal.id]),
  // This group is for IAM access
  securityEnabled: true,
})
new authorization.RoleAssignment(`${p}allowreadconfigs`, {
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
new authorization.RoleAssignment(`${p}allowreadresources`, {
  scope: resourceGroup.id,
  principalId: workers.id,
  principalType: 'Group',
  /*
  Reader
  View all resources, but does not allow you to make any changes.
  */
  roleDefinitionId:
    '/providers/Microsoft.Authorization/roleDefinitions/acdd72a7-3385-48ef-bd42-f606fba81ae7',
})

// -----------------------
// --- BASIC RESOURCES ---
// -----------------------

/*
Here we store all our app configs
This way local app instances and cloud can share the same configs
*/
const appConfig = new appconfiguration.ConfigurationStore(
  `${p}config`,
  {
    resourceGroupName: resourceGroup.name,
    sku: {
      /*
      Standard is $1.20 a day, lol, I will never return these $30 #cloudbill
      */
      name: 'Free',
    },
  }
  /*
  All our instances should have a stable access point to config, so let's block any delete attempt
  This will allow to have stable APP_CONFIG_NAME across all the system
  If you change appConfig you need to manually update .env
  */
  // { protect: true }
)

const setConfig = (keyValueName: string, value: pulumi.Input<string>) =>
  new appconfiguration.KeyValue(p + keyValueName + 'config', {
    resourceGroupName: resourceGroup.name,
    configStoreName: appConfig.name,
    keyValueName: keyValueName,
    value: value,
  })

/*
Will collect all our logs and provide KQL search interface to them
Handy for debugging
*/
const appInsights = new insights.Component(`${p}insights`, {
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
const storageAccount = new storage.StorageAccount(`${p}sa`, {
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
  `${p}blobimages`,
  {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
    containerName: 'articleimages',
    // we don't need a public access for our images
    publicAccess: 'None',
  }
  // We have valuable client data there, so let's block any delete attempt
  // { protect: true }
)

// ------------------------
// --- THE MONOLITH APP ---
// ------------------------

// Should be user-friendly for prod cuz will be a part of domain
const appName = p

/*
Build and publish the Docker container image
The image will be several gigabytes, it way take 10-20 minutes to push it to the registry
Then another 10-20 minutes to run it
Deployment is slow
Try run the docker container locally before trying to deploy it, it may save you a lot of time
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
  serverFarmId: cfg.require('appServicePlanId'),
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
    // nodes count, more nodes – more power
    preWarmedInstanceCount: 1,
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
  name: `Hashnode Cover App ${p}`,
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
  MONGO_CONNECTION_STRING: cfg.requireSecret('MONGO_CONNECTION_STRING'),
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
As you can see configuration of infrastructure is always a big hassle
This is why it's very sane to delegate it to Vercel/Netlify clouds
However, you can't delegate everything
*/
