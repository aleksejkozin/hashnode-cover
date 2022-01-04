/*
Ascend

# Infrastructure as Code
The idea:
- Usually, you have a lot of configurations in different clouds done manually via UI
- Configurations are many and hard
- IaC allows you to put all these configs into a one file
- This way you can reproduce and reason about the configs

If you run this file with Pulumi it will automatically create resources in:
- Azure cloud
- Auth0 cloud
- etc
All the settings are 1 to 1 to UI of the corresponding clouds

Benefits:
- You store all infrastructure configs in one place
- You can copy the infrastructure as text files
- You can use JS to describe your infrastructure, eg, loops/conditions/comments
- You can work on infrastructure with git, eg, code reviews, merge requests
- You can have dev/prod deployments that will be identical, cuz you run them from code
- You can even have deployment for every git branch

# The Initial Run
CI pipeline needs to login to clouds to be able to manage the infrastructure.
Eg, the GitHub needs API access to our clouds.
To provide the access we need to create additional resources in the clouds.
This is a chicken-egg problem.
Thus the first run needs to be done with you user credentials, it will create the CI credentials.

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
import * as insights from '@pulumi/azure-native/insights'
import * as path from 'path'
import * as docker from '@pulumi/docker'
import * as pulumi from '@pulumi/pulumi'
import { interpolate } from '@pulumi/pulumi'
import * as azuread from '@pulumi/azuread'
import * as authorization from '@pulumi/azure-native/authorization'
import * as auth0 from '@pulumi/auth0'
import * as random from '@pulumi/random'

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

// CI's Service Principal should have owner access to this group
const resourceGroup = resources.getResourceGroupOutput({
  resourceGroupName: cfg.require('resourceGroupName'),
})

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
const workers = new azuread.Group(`${p}workers`, {
  displayName: `${p}workers`,
  // This group is for IAM access
  securityEnabled: true,
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

// Container is like a folder for your data. Here we will store articles' cover images
new storage.BlobContainer(
  `${p}blobimages`,
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
*/
const { imageName } = new docker.Image(`${appName}image`, {
  imageName: interpolate`${dockerRegistry.server}/${appName}`,
  build: {
    target: 'runner',
    context: path.join(__dirname, '../../'),
    dockerfile: path.join(__dirname, 'Dockerfile'),
    // It seems cacheFrom is super slow, skipping it
    // cacheFrom: { stages: ['dependencies', 'builder', 'runner'] },
  },
  registry: dockerRegistry,
})

/*
Beginning of 2022: Don't run your applications with "nx run-many --parallel ..."
If one of the apps crashes the rest continue to live
And you want them all dead, so they would be restarted with "restart: always"

--watch=false will make sure that nx will exit on an app crash
*/
const dockerCompose = interpolate`
services:
  application:
    image: ${imageName}
    ports:
      - "3000:3000"
    restart: always
    entrypoint: yarn nx serve cover --prod --watch=false
    healthcheck:
      test: [ "CMD", "curl", "-f", "http://localhost:3000" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 1m

  workers:
    image: ${imageName}
    restart: always
    entrypoint: yarn nx serve cover-workers --prod --watch=false
`.apply((x) => Buffer.from(x).toString('base64'))

const app = new web.WebApp(appName, {
  resourceGroupName: resourceGroup.name,
  // We use an external service plan cuz it costs money to create a new one
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
    // Also supports "DOCKER|<image>" if you only have 1 container
    linuxFxVersion: interpolate`COMPOSE|${dockerCompose}`,
    httpLoggingEnabled: true,
    detailedErrorLoggingEnabled: true,
    logsDirectorySizeLimit: 35, //in MB
    // nodes count, more nodes – more power
    preWarmedInstanceCount: 1,
  },
})

// Our app should have access to our cloud resources
new azuread.GroupMember(appName + 'isworker', {
  groupObjectId: workers.id,
  memberObjectId: app.identity.apply((x) => x?.principalId),
})

// Our app will be run on these endpoints
export const appUrl = interpolate`https://${app.defaultHostName}`
const localUrl = 'http://localhost:3000'
const appUrls = [appUrl, localUrl]

// Configure auth. We will use https://auth0.com/ as an OIDC provider
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

// Cloud Apps, local Docker containers, etc, everyone will have these environment variables
export const globalEnvironmentVariables = {
  AUTH0_ISSUER_BASE_URL: interpolate`https://${auth0.config.domain}`,
  AUTH0_CLIENT_ID: auth0Application.clientId,
  AUTH0_CLIENT_SECRET: auth0Application.clientSecret,
  MONGO_CONNECTION_STRING: cfg.requireSecret('MONGO_CONNECTION_STRING'),
  STORAGE_ACCOUNT: storageAccount.name,
}
new web.WebAppApplicationSettings(appName + 'settings', {
  resourceGroupName: resourceGroup.name,
  name: app.name,
  properties: {
    // App Insights config
    APPINSIGHTS_INSTRUMENTATIONKEY: appInsights.instrumentationKey,
    // Do not persist or share /home/ directory between instances
    WEBSITES_ENABLE_APP_SERVICE_STORAGE: 'false',
    // linuxFxVersion use this docker connection to pull images
    DOCKER_REGISTRY_SERVER_URL: `https://${dockerRegistry.server}`,
    DOCKER_REGISTRY_SERVER_USERNAME: dockerRegistry.username,
    DOCKER_REGISTRY_SERVER_PASSWORD: dockerRegistry.password,
    // Continues deployment. Will automatically pull new images
    DOCKER_ENABLE_CI: 'true',
    // Our application exposed port. We run NextJs on it
    WEBSITES_PORT: '3000',
    // We need to bake this here so common variables update would restart the container
    ...globalEnvironmentVariables,
    // These AUTH0_* configs are specific to this web app instance and should not be shared outside
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
