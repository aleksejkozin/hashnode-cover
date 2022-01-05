# --kill-others will kill all the apps if one of the app crashes
# this will allow docker to restart
yarn env-cmd yarn concurrently --kill-others --raw \
  "env-cmd -f packages/cover/.env          node_modules/.bin/next start dist/packages/cover -p 3000" \
  "env-cmd -f packages/cover-workers/.env  node dist/packages/cover-workers/main.js"
