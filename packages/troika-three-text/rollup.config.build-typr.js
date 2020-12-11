// This build file creates a static version of the Typr.ts library used for
// processing fonts. It's isolated within a "factory" function wrapper so it can
// easily be marshalled into a web worker.


import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'


const {LERNA_ROOT_PATH} = process.env
if (!LERNA_ROOT_PATH) {
  throw new Error("Please execute `npm run build-typr` from the repository root.")
}


const OUTPUT_TEMPLATE = `
/*!
Custom build of Typr.ts (https://github.com/fredli74/Typr.ts) for use in Troika text rendering.
Original MIT license applies: https://github.com/fredli74/Typr.ts/blob/master/LICENSE
*/

export default function() {
  // Trick it into being able to run in a web worker
  if (typeof window === 'undefined') {
    self.window = self
  }

  $$CONTENT$$

  return TyprExports.Typr
}
`

const [banner, footer] = OUTPUT_TEMPLATE.split('$$CONTENT$$')


export default {
  // Starting from the src modules rather than dist as that gives us more fine-grained control
  input: LERNA_ROOT_PATH + '/node_modules/@fredli74/typr/dist/Typr.js',
  plugins: [
    nodeResolve(),
    commonjs(),
    {
      name: 'custom',
      transform(source, id) {
        // Quiet the console.warn statements added in the Typr.ts fork
        source = source.replace(/console\.warn/g, 'console.debug')
        return source
      }
    },
    terser({
      ecma: 5
    })
  ],
  output: {
    format: 'iife',
    exports: 'named',
    name: 'TyprExports',
    file: 'libs/typr.factory.js',
    banner,
    footer
  }
}
