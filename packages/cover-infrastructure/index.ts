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
import {interpolate} from '@pulumi/pulumi'
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
At first we will create a service principal for our application
SP is like a user account, but it for programs, and not humans
We can attach permissions to the SP. The app needs the permissions to have access to Azure resources
What you need to know about the permissions:
- They propagate slowly, about 15 minutes after creating they become available
- You need permissions to do any operation with an Azure resource, even to read config
*/
// Warning: Might be deprecated on 30 of June of 2022
const adApp = new azuread.Application(`${p}adapp`, {
  displayName: `${p}`,
})
const runnerSp = new azuread.ServicePrincipal(`${p}adsp`, {
  applicationId: adApp.applicationId.apply(async x => {
    // Workaround for a bug in Terraform
    await new Promise(resolve => setTimeout(resolve, 10000))
    return x
  }),
})
const runnerSpPass = new azuread.ApplicationPassword(`${p}adapppass`, {
  applicationObjectId: adApp.objectId,
})
// Here put all the app's permissions
new authorization.RoleAssignment(`${p}allowreadresources`, {
  scope: resourceGroup.id,
  principalId: runnerSp.id,
  principalType: 'ServicePrincipal',
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
  {protect: false},
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
const {imageName} = new docker.Image(`${appName}image`, {
  imageName: interpolate`${dockerRegistry.server}/${appName}`,
  build: {
    target: 'runner',
    context: path.join(__dirname, '../../'),
    dockerfile: path.join(__dirname, 'Dockerfile'),
  },
  registry: dockerRegistry,
})
const app = new web.WebApp(appName, {
  resourceGroupName: resourceGroup.name,
  // We use an external service plan cuz it costs money to create a new one
  serverFarmId: cfg.require('appServicePlanId'),
  httpsOnly: true,
  kind: 'app',
  siteConfig: {
    // Could be enabled starting from B1 AppServicePlan
    alwaysOn: true,
    linuxFxVersion: interpolate`DOCKER|${imageName}`,
    httpLoggingEnabled: true,
    detailedErrorLoggingEnabled: true,
    logsDirectorySizeLimit: 35, //in MB
    /*
    Nodes count
    Our app is stateless, with load balancers and queues
    This means more nodes = more power
    */
    preWarmedInstanceCount: 1,
  },
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
  allowedLogoutUrls: appUrls.map(x => interpolate`${x}/api/auth/logout`),
  callbacks: appUrls.map(x => interpolate`${x}/api/auth/callback`),
})

/*
Cloud Apps, local Docker containers, etc, everyone will have these environment variables
Don't rename this variable, the name is important for the local app to work
Warning:
- You will need to rotate out your secrets when you remove members of your team
- If you will not do it, then removed team member will still have output.json with all dev secrets
Secretes created by Pulumi are easy to rotate, just update their name
However, external secrets like MONGO_CONNECTION_STRING you will need to rotate manually
Usually such services have a setting to rotate secrets automatically on timer
*/
export const globalEnvironmentVariables = {
  STORAGE_ACCOUNT: storageAccount.name,
  MONGO_CONNECTION_STRING_SECRET: cfg.requireSecret('MONGO_CONNECTION_STRING'),
  // These allow to login into Azure using DefaultAzureCredential()
  AZURE_CLIENT_ID: runnerSp.applicationId,
  AZURE_TENANT_ID: runnerSp.applicationTenantId,
  AZURE_CLIENT_SECRET: runnerSpPass.value,
  // For OIDC auth
  AUTH0_BASE_URL: localUrl,
  AUTH0_SECRET: new random.RandomPassword(appName + 'auth0localsecret', {
    length: 256,
  }).result,
  AUTH0_ISSUER_BASE_URL: interpolate`https://${auth0.config.domain}`,
  AUTH0_CLIENT_ID: auth0Application.clientId,
  AUTH0_CLIENT_SECRET: auth0Application.clientSecret,
}
// Anyone that has access to WebApp settings has access to all the secrets
new web.WebAppApplicationSettings(appName + 'settings', {
  resourceGroupName: resourceGroup.name,
  name: app.name,
  properties: {
    // We need to bake this here so common variables update would restart the container
    ...globalEnvironmentVariables,
    // App Insights config. Don't pass this key to global cuz this will pollute logs
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
    /*
    These AUTH0_* configs are specific to this web app instance and should not be shared outside
    Should overwrite globalEnvironmentVariables
    */
    AUTH0_BASE_URL: appUrl,
    AUTH0_SECRET: new random.RandomPassword(appName + 'auth0secret', {
      length: 256,
    }).result,
  },
})
