# Check this introduction to Docker video: https://www.youtube.com/watch?v=Gjnup-PuquQ
#
# You need Docker when:
# - You have some dependency that could not be installed with npm/yarn
# - Your workers need to run task bigger than 2 minutes
# Other use cases could be covered with small hacks. Docker is a hassle, don't use it without a reason.
# If all your dependencies live inside package.json then don't use Docker:
# - Use Vercel cloud to deploy your Next.js app
# - Background tasks/Cron could be emulated with periodict ping of routes with https://www.easycron.com/
#
# However, I'll assume that we need Dcoker tho. Just for an exercise.
# I copied a base Dockerfile from https://nextjs.org/docs/deployment
# And then polished it to my usecase
#
# Rules of Docker thumb:
# - You want to keep you container *very very small*. Otherwise your deployment will be slow
# - To make a small containers you need to use "alpine" distrs
# - To make a small containers you need webpack your applications
# - To make a small containers you need to delete max node_modules
# -- Most of the dependencies you can bake with webpack into a single bundle.js
# -- Some dependencies could not be baked cuz there is no npm package for them, or they are cli tools.
#    Install them with Docker RUN, or put them into "dependencies" package.json
# -- Everything you can bake into bundle.js put into "devDependencies" of package.json
# -- Prune all "devDependencies" of all your packages
#
# At some point you will run out of space on your disk cuz containers are big
# In this case run docker prune everything command: "docker system prune -a -f"

# Install dependencies only when needed
FROM node:14-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
# This is a cache layer for all package.json and yarn.lock
# If package.json has not changed you will use this layer as a cache so you will not wait node_modules to download
# Root deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
# Here list all your monorepo packages we want in the final image
COPY ./packages/application/package.json ./packages/application/package.json
COPY ./packages/common/package.json ./packages/common/package.json
COPY ./packages/tools/package.json ./packages/tools/package.json
RUN yarn install --frozen-lockfile --prefer-offline


# Rebuild the source code only when needed
FROM node:14-alpine AS builder
# Prefer "COPY --from" for multisatege builds over "FROM x". It makes more clean cuts
COPY --from=deps /app/ /app/
WORKDIR /app
COPY . .
RUN yarn build \
    # we will prune all devDependencies after build
    # eg, we will leave only dependencies that we need to run our app \
    # only npm has an ability to prune
    && npm prune --production --workspaces=true --include-workspace-root


# Production image, copy all the files and run start script for all the monorepo
FROM node:14-alpine AS runner
# We copy only builded app without devDependencies, this saves x10 of image size
COPY --from=builder /app/ /app/
WORKDIR /app
ENV NODE_ENV production
EXPOSE 3000
CMD ["yarn", "start"]
