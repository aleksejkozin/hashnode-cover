const withTM = require('next-transpile-modules')([
  /*
  Here list all the monorepo's modules you want to include inside the app
  Without the list the app will not transpile TS to JS and the build will fail
  You can "build" your modules to js and then import them, but this is a hassle
  So, type your modules here
  */
  '@hashnode-cover/common',
])

/*
This is a webpack config
We just extend default config with our own
*/

module.exports = {
  ...withTM(),
  reactStrictMode: true,
  trailingSlash: true,
}
