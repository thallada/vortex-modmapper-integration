let webpack = require('vortex-api/bin/webpack').default;
const WebpackDynamicPublicPathPlugin = require("webpack-dynamic-public-path");

const config = webpack('vortex-modmapper-integration', __dirname, 4);

config.resolve.extensions.push(".wasm");
config.entry = { "vortex-modmapper-integration": "./src/index.ts" };

config.output.publicPath = "publicPathPlaceholder";
// hack to get webpack to load chunks and wasm from the vortex extension directory
config.plugins.push(new WebpackDynamicPublicPathPlugin({
  externalPublicPath: `"file:///" + __dirname + "/"`,
  chunkNames: ["vortex-modmapper-integration"],
}));

config.output.sourceMapFilename = `[name].js.map`

module.exports = config;