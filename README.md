# HashnodeCover

## Requirements

- Pulumi. You will also need to "pulumi login" and request access to the pulumi stack from an admin. This will allow you
  to pull global_environment.json which contains all the app configs. Without these configs you can't run the app even in a dev mode
- Additional dependencies may apply, please, check Dockerfile -> dependencies stage for more information

If you want to deploy to Azure then you need:

- Azure CLI. You will also need to "az login" and request access to the Azure resource group from an admin
- Docker

You can also run the app in a docker, for this you need docker and webstorm.
