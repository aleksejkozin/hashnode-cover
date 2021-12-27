# Loading local/global environment variables
# This will create .env.global file with global cloud environment variables
yarn nx build loadenv && yarn env-cmd -f .env node ./dist/packages/loadenv/main

# Run everything with serve target in prod mode
yarn env-cmd -f .env -f .env.global yarn nx run-many --parallel --target=serve --all "$@"
