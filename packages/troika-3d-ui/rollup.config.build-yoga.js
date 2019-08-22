// This build file creates a static version of the Yoga library used for computing
// flexbox layouts. It's isolated within a "factory" function wrapper so it can
// easily be marshalled into a web worker.

import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import {minify} from 'terser'

const {LERNA_ROOT_PATH} = process.env
if (!LERNA_ROOT_PATH) {
  throw new Error("Please execute `npm run build-yoga` from the repository root.")
}


const OUTPUT_TEMPLATE = `
// Custom build of Yoga (https://yogalayout.com/) for use in Troika UI layout.
// Original MIT license applies: https://github.com/facebook/yoga/blob/master/LICENSE

export default function() {
  $$CONTENT$$

  return Yoga
}
`

const [banner, footer] = OUTPUT_TEMPLATE.split('$$CONTENT$$')


export default {
  input: LERNA_ROOT_PATH + '/node_modules/yoga-layout-prebuilt/yoga-layout/dist/entry-browser.js',
  plugins: [
    nodeResolve(),
    {
      name: 'custom',
      transform(source, id) {

        // Special handling for nbind.js:
        if (/node_modules\/.*\/nbind\.js$/.test(id)) { //only match the real nbind.js not the importer created by nodeResolve
          // Fix undeclared var error:
          source = source.replace('_a = _typeModule(_typeModule),', 'var _a = _typeModule(_typeModule);')

          // Pre-compress and stringify nbind contents so downstream build tools don't mangle the asm
          source = minify(source, {
            compress: true,
            mangle: true,
            ecma: 5
          }).code
          source = `const $module={exports:{}};
            (new Function('module', \`${source.replace(/\\/g, '\\\\')}\`))($module);
            export default $module.exports;`
        }

        return source
      }
    },
    commonjs(),
  ],
  output: {
    format: 'iife',
    name: 'Yoga',
    file: 'libs/yoga.factory.js',
    banner,
    footer
  }
}
