const path = require('path');
const webpack = require('webpack');
const env = process.env.NODE_ENV || 'development';
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: env,
  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    popup: './src/popup/index.ts'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "crypto": false,
      "stream": false,
      "util": false,
      "buffer": false
    }
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(
      /(.*)config(\.*)$/,
      function(resource) {
        resource.request = resource.request.replace(
          /config/,
          `config.${env === 'production' ? 'prod' : 'dev'}`
        );
      }
    ),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'images', to: 'images' },
        { from: 'manifest.json', to: 'manifest.json' },
      ],
    }),
  ],
  target: 'web'
};
