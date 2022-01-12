/*
Webpack can bundle multiple files into a single file
It produces a single compact bundle.js that can be send via HTTP to clients
Will parse all the node_modules and extract only parts we actually use
Can call Babel to transform code to older standards

Can also split the result bundle into multiple bundles if you use "await import(...)" syntax
This way you make your app faster to load

A video regard Webpack:
https://www.youtube.com/watch?v=X1nxTjVDYdQ
*/

const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const WebpackShellPluginNext = require('webpack-shell-plugin-next')
const nodeExternals = require('webpack-node-externals')
const CopyPlugin = require('copy-webpack-plugin')
const {merge} = require('webpack-merge')

const base = {
  mode: process.env.NODE_ENV || 'development',
  module: {
    rules: [
      // Process all the code with babel
      {
        test: /\.(jsx?|tsx?)$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      // Also pack binaries, like sharp binaries
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },
  resolve: {
    // What extensions "import" modules can have
    extensions: ['.js', '.jsx', '.ts', '.tsx', '*'],
  },
  ignoreWarnings: [
    // This module is not mandatory, we can skip this warning if it doesn't exist
    /global_environment.json/,
    // Does nothing, some bug in azure, we can skip it
    /applicationinsights-native-metrics/,
  ],
  // This will speed up rebuilds drastically
  cache: {
    type: 'filesystem',
    allowCollectingMemory: true,
  },
  // This is how we can link an error in the compiled code with the original code
  devtool: 'source-map',
}

const frontend = merge(base, {
  target: 'web',
  entry: path.resolve(__dirname, './src/frontend/index.tsx'),
  output: {
    path: path.resolve(__dirname, './dist/frontend/public/'),
    filename: 'bundle.js',
  },
  externalsPresets: {web: true},
  plugins: [
    // This one will use the template and import the compiled bundle into it
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './src/frontend/index.html'),
    }),
    // This is how you can copy assets from source to public folder
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, './src/frontend/public/'),
          to: path.resolve(__dirname, './dist/frontend/public/'),
        },
      ],
    }),
  ],
})

const backend = merge(base, {
  target: 'node',
  entry: path.resolve(__dirname, './src/backend/index.ts'),
  output: {
    path: path.resolve(__dirname, './dist/backend/'),
    filename: 'bundle.js',
  },
  externalsPresets: {node: true},
  /*
  "don't bundle node modules" cuz this is a hassle
  you can configure nodeExternals() to bundle some dependencies
  and then exclude them from prod build with rm -rf
  but this is a complexity spike
  */
  externals: [nodeExternals()],
  plugins: [
    new WebpackShellPluginNext({
      // This will execute in dev mode
      onWatchRun: {
        scripts: ['yarn serve:dev', 'yarn tsc --watch'],
        blocking: false,
        parallel: true,
      },
    }),
  ],
})

module.exports = [frontend, backend]
