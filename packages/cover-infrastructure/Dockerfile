# Check this introduction to Docker video: https://www.youtube.com/watch?v=Gjnup-PuquQ
#
# JS is super powerful. You can do with it everything: front, back, even deploy infrastructure
# You can easily install dependencies with npm/yarn, even platform native dependencies
# However, sometimes node_modules is not enough
#
# Sometimes you need Docker. You need Docker only when:
# - Your background tasks take more than 4 minutes to complete
# - You have some dependency that couldn't be installed with npm/yarn
#   JS ecosystem is so powerful that you can even install native dependencies with npm
#   Sadly, sometimes it's not the case, and you need install something inside your OS manually
#
# If all your dependencies live inside package.json then don't use Docker. Use Vercel/Netlify cloud:
# - Use Vercel/Netlify cloud to deploy your Next.js app. They use Docker under the hood, but they abstract away the details
# - Background tasks/cron could be emulated with periodic ping of routes with https://www.easycron.com/ or github actions
# - You will also need to configure certificate for "az login" to have access to other infrastructure
#
# The differenece between using only Vercel vs deploying Docker with Pulumi to Azure is a x10 difficulty spike
# Double check that you need this spike
#
# Why Docker is a hassle:
# - Slow build. Especially slow when you update package.json
# - Slow deploy. You need to send these >2GB over the wire
# - You need to learn Docker
# - You will need to learn how to work on a low level of an OS
# - Vercel/Netlify provides edge computing that is like global CND for NextJs. There is no edge with your Docker
#
# Ideally, you deploy NextJs to Vercel/Netlify and background workers in a Docker to Azure/DigitalOcean/AWS cloud
# However, it is a hassle, cuz you'll need several accounts
#
# I'll assume that we need Docker for a native dependency and we have only have an Azure account.
# Just for an exercise, cuz I need Docker/Azure in my work.
#
# Rules of Docker thumb:
# - You want your Docker builds to be fast, thus you need to cache dependencies in intermidiate layers
# - You want to keep your container smaller. Otherwise your deployment will be slow
# - You may be tempted to use Docker for local development, but you shouldn't
#   You will not be able to attach debugger and run test from IDE
#   You will also get conflicts with node_modules if you mount your local project folder to the container
#   The conflict: your os is deffirent form container's os
#   This can be resolved by moving container /monorepo/node_modules to /node_modules on docker but this is a hassle
#   Don't develop under Docker, install dependencies locally and run your app
#
# At some point you will run out of space on your disk cuz containers constantly produce waste
# In this case run: "docker system prune -a -f"
#


FROM node:14-alpine AS dependencies
# Here we install our native OS dependencies
# If you want to develop the project locally you will need to install them into your OS
RUN apk update && apk add --no-cache \
    # nx uses git to calculate affected changes
    git \
    curl
# Without workdir yarn install will hang cuz it will parse all the system files
WORKDIR /monorepo
# If package.json hasn't changed you will use this layer as a cache so you'll not wait node_modules to download
COPY package.json yarn.lock ./
# We would like to mount a yarn cache so we wouldn't need to re download dependencies from the internet
# The mount works only with enabled Buildkite
# Warning, don't mount a cache on node_modules, this will remove them from the container and put into the cache
# This way you wont be able to bake the dependencies inside the container
RUN --mount=type=cache,target=/usr/local/share/.cache \
    yarn install --frozen-lockfile --prefer-offline


FROM dependencies AS builder
WORKDIR /monorepo
COPY . .
RUN --mount=type=cache,target=/usr/local/share/.cache \
    # We would like to mount nx cache so rebuilds would be faster
    --mount=type=cache,target=/monorepo/node_modules/.cache \
    yarn nx run-many --target=build --parallel --all --prod
# You can remove dev dependencies, it will save you ~500Mb, but can create a surprise failed updload
# It doesn't worth it


# Will bake your credentials inside a container
# You will need to click on the URL in terminal to log in and enter the code.
# Warning: the code might be split on 2 lines due to output corruption
FROM mcr.microsoft.com/azure-cli AS login
RUN az login


# Use this container to run the app locally
# You will also need to bake "output.json" inside the container
# In Webstom "Right click on the Dockerfile -> Run"
# Webstorm has all configs baked into "cover-infrastructure_Dockerfile.run.xml"
FROM builder AS local_runner
# Copy baked credentials to the container
COPY --from=login /root/.azure /root/.azure
WORKDIR /monorepo
EXPOSE 3000
CMD packages/cover-infrastructure/run.sh


# Production runner
# Azure cloud will automatically provide a managed identity credentials as MSI env variables
# But you can't just run the container locally:
# - You'll need to install and do "az login"
# - You'll need to pass Pulumi output as global environment variables
FROM builder AS runner
WORKDIR /monorepo
EXPOSE 3000
CMD packages/cover-infrastructure/run.sh

