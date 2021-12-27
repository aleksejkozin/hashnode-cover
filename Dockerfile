# Check this introduction to Docker video: https://www.youtube.com/watch?v=Gjnup-PuquQ
#
# You need Docker when:
# - You have some dependency that could not be installed with npm/yarn
# - Your workers need to run task bigger than 2 minutes
# Other use cases could be covered with small hacks. Docker is a hassle, don't use it without a reason
# If all your dependencies live inside package.json then don't use Docker:
# - Use Vercel cloud to deploy your Next.js app
# - Background tasks/Cron could be emulated with periodic ping of routes with https://www.easycron.com/
#
# I'll assume that we need Docker tho. Just for an exercise.
#
# Rules of Docker thumb:
# - You want your Docker builds to be fast, thus you need to cache dependencies in intermidiate layers
# - You want to keep your container smaller. Otherwise your deployment will be slow
# - You may be tempted to use Docker for local development
#   However, you will not be able to attach debugger to an application inside a container
#   You will also get conflict with node_modules if you mount your local project folder to the container
#   The conflict: your os is deffirent form container's os.
#   This can be resolved by moving container /monorepo/node_modules to /node_modules but this is a hassle
#   Don't develop under Docker, install dependencies locally and run your app
#
# At some point you will run out of space on your disk cuz containers constantly produce waste
# In this case run: "docker system prune -a -f"


FROM node:14-alpine AS dependencies
RUN apk update && apk add --no-cache git
# Without workdir yarn install will hang cuz it will parse all the system files
WORKDIR /monorepo
# If package.json hasn't changed you will use this layer as a cache so you'll not wait node_modules to download
COPY package.json yarn.lock ./
# We would like to mount yarn cache so we wouldn't need to re download dependencies from the internet
# The mount works only with enabled Buildkite
RUN --mount=type=cache,target=/usr/local/share/.cache \
    yarn install --frozen-lockfile --prefer-offline


FROM dependencies AS builder
WORKDIR /monorepo
COPY . .
RUN --mount=type=cache,target=/usr/local/share/.cache \
    # We would like to mount nx cache so rebuilds would be faster
    --mount=type=cache,target=/monorepo/node_modules/.cache \
    yarn nx run-many --prod --parallel --target=build --max-parallel=3 --all --exclude=cover-infrastructure
# You can remove dev dependencies, it will save you ~500Mb, but can create a surprise failed updload
# Also, only can *really* save if you will use "COPY --from=builder" instead of "FROM builder AS runner" which is a hassle
# RUN npm prune --production


# Production runner
# Azure cloud will acutomatically provide managed identity credentials as env variables
FROM builder AS runner
WORKDIR /monorepo
EXPOSE 3000
CMD ./run.sh --prod
