// build-sea.js - esbuild bundle with a plugin that maps the native addon
// require to a runtime dlopen of the copy shipped beside the executable.
const esbuild = require('esbuild');

const ADDON_SPECIFIER = './build/Release/pwaos_addon.node';

const plugin = {
  name: 'sea-addon',
  setup(build) {
    build.onResolve({ filter: /^\.\/build\/Release\/pwaos_addon\.node$/ }, () => ({
      path: 'sea-addon-shim',
      namespace: 'sea-addon',
    }));
    build.onLoad({ filter: /.*/, namespace: 'sea-addon' }, () => ({
      contents: `
        const path = require('path');
        const addonPath = path.join(path.dirname(process.execPath),
          'node_modules', '@pwaos', 'runtime-client', 'build', 'Release', 'pwaos_addon.node');
        // Native addons must be loaded from disk - embed them? Not possible.
        // Use process.dlopen on a Module instance:
        const Module = require('module');
        const mod = new Module('pwaos_addon');
        mod.filename = addonPath;
        process.dlopen(mod, addonPath);
        module.exports = mod.exports;
      `,
      loader: 'js',
    }));
  },
};

(async () => {
  await esbuild.build({
    entryPoints: ['sea-entry.js'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: 'sea-bundle.js',
    plugins: [plugin],
    logLevel: 'info',
  });
})();
