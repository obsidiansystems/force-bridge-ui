// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
const CracoLessPlugin = require('craco-less');
const process = require('process');
const liveDevBridge = 'https://force-bridge-dev.ckbapp.dev';
const { addBeforeLoader, loaderByName } = require('@craco/craco');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const wasmExtensionsRegExp = /\.wasm$/;
      webpackConfig.resolve.extensions.push('.wasm');

      webpackConfig.module.rules.forEach((rule) => {
        (rule.oneOf || []).forEach((oneOf) => {
          if (oneOf.loader && oneOf.loader.indexOf('file-loader') >= 0)
          {
            oneOf.exclude.push(wasmExtensionsRegExp);
          }
        });
      });

      const wasmLoader = {
        test: /\.wasm$/,
        exclude: /node_modules/,
        loaders: ['wasm-loader'],
      };

      addBeforeLoader(webpackConfig, loaderByName('file-loader'), wasmLoader);

      return webpackConfig;
    }
  },
  babel: {
    plugins: ['babel-plugin-styled-components'],
  },
  devServer: {
    proxy: {
      '/api': {
        target: 'https://force-bridge-dev.ckbapp.dev',
        cookieDomainRewrite: true,
        headers: { host: 'force-bridge-dev.ckbapp.dev' },
        // pathRewrite: { '^/api': '' },
      },
      // '/api': {
      //   target: 'http://mainnet-watcher.force-bridge.com',
      //   cookieDomainRewrite: true,
      //   headers: { host: 'mainnet-watcher.force-bridge.com' },
      //   pathRewrite: { '^/api': '' },
      // },
    },
  },
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: {
              '@primary-color': '#00CCC0',
              '@border-radius-base': '8px',
              '@btn-border-radius-base': '8px',
            },
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
};
