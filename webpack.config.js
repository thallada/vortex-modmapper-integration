let webpack = require('vortex-api/bin/webpack').default;
const WebpackDynamicPublicPathPlugin = require("webpack-dynamic-public-path");

const config = webpack('modmapper-integration', __dirname, 4);

config.resolve.extensions.push(".wasm");
config.entry = { app: "./src/index.ts" };

config.output.publicPath = "publicPathPlaceholder";
// hack to get webpack to load chunks and wasm from the vortex extension directory
config.plugins.push(new WebpackDynamicPublicPathPlugin({
  externalPublicPath: `"file:///" + __dirname + "/"`,
  chunkNames: ["app"],
}));

module.exports = config;