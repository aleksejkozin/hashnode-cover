const path = require('path')
const glob = require('glob')

/*
This is the Base Webpack Configuration.
We will import it in ./packages/* that uses webpack

What webpack does – it joins all the million js/ts files into one file.
All your code is now packed and optimised into a single file.
This is why you can delete node_modules of "devDependencies" from a production docker container.
Some files webpack cannot pack: binaries, assets, images, etc. They will leave around the bundle.js
NextJs uses webpack internally too

Also check this video: https://www.youtube.com/watch?v=5IG4UmULyoA
*/

module.exports = {
  // Treat everything in the 'src' directory as an entry point
  entry: Object.fromEntries(
    glob
      .sync('./src/*.{js,ts}', {
        ignore: './src/*.spec.*',
      })
      .map(x => [path.parse(x).name, x]),
  ),
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  // Adds source mappings and base64 encodes them, so they can be inlined in your generated file.
  devtool: 'inline-source-map',
  target: 'node',
  /*
  We need to configure how webpack resolves modules so it could find monorepo packages
  By default monorepo can't find them
  */
  resolve: {
    /*
    We need to create an alias for each monorepo package
    By default webpack can't find packages in monorepo sadly
    */
    alias: Object.fromEntries(
      glob
        .sync('../*')
        .map(relativePackageDir => [
          require(path.join(relativePackageDir, 'package.json')).name,
          path.resolve(__dirname, relativePackageDir),
        ]),
    ),
    // By default .tsx? will not be resolved by webpack
    extensions: ['.tsx', '.ts', '...'],
  },
  module: {
    // Webpack is dumb and need explanations on how to pack non js files
    rules: [
      {
        // Pack .ts .tsx with ts-loader
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        // Pack .node with node-loader
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },
  optimization: {
    /*
    We don't transfer tools via wire, so there is no reason to minimize them
    Also, some modules require class names in production and minimize removes them
    */
    minimize: false,
  },
  // Will speed up rebuilds x5
  // cache: {
  //   type: 'filesystem',
  //   allowCollectingMemory: true,
  // },
}
