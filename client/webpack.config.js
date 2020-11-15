const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "development",

  devServer: {
    contentBase: path.join(__dirname, "../dist/client"),
    compress: true,
    disableHostCheck: true,
    clientLogLevel: "silent",
    port: 3200,
    sockPort: 443,
    sockHost: "trd.local",
  },

  output: {
    publicPath: "/app",
  },
  // Enable sourcemaps for debugging webpack's output.
  devtool: "source-map",

  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".js", ".ts", ".tsx"],
  },

  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
            },
          },
        ],
      },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      {
        enforce: "pre",
        test: /\.js$/,
        loader: "source-map-loader",
      },
    ],
  },
  // Split vendor libs in seperate bundle.
  optimization: {
    splitChunks: {
      chunks: "all",
    },
  },
  // Generate default index.html
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html",
    }),
  ],
};
