const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const {merge} = require('webpack-merge')

const base = {
  mode: 'development',
  resolve: {
    // Allow webpack to resolve these extensions
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      // This will enable TypeScript support
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  // This will speed up rebuilds drastically
  cache: {
    type: 'filesystem',
    allowCollectingMemory: true,
  },
}

const frontend = merge(base, {
  entry: path.join(__dirname, 'src/frontend/index.tsx'),
  output: {
    path: path.join(__dirname, 'src/frontend/public/dist/'),
    filename: 'bundle.js',
  },
  plugins: [
    // This one will use the template and import the compiled bundle into it
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src/frontend/index.html'),
    }),
  ],
})

module.exports = [frontend]
