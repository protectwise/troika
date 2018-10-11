// This build file creates a static version of the OpenType.js library used for 
// processing fonts. It's isolated within a "factory" function wrapper so it can
// easily be marshalled into a web worker. It also removes some bits from the
// OpenType library that are never needed by Troika's text rendering.


import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'


const {LERNA_ROOT_PATH} = process.env
if (!LERNA_ROOT_PATH) {
  throw new Error("Please execute `npm run build-opentype` from the repository root.")
}


const OUTPUT_TEMPLATE = `
// Custom build of OpenType (https://opentype.js.org/) for use in Troika text rendering. 
// Original MIT license applies: https://github.com/nodebox/opentype.js/blob/master/LICENSE

export default function() {
  // Trick opentype into being able to run in a web worker
  if (typeof window === 'undefined') {
    self.window = self
  }

  $$CONTENT$$

  return opentype
}
`

const [banner, footer] = OUTPUT_TEMPLATE.split('$$CONTENT$$')


export default {
  // Starting from the src modules rather than dist as that gives us more fine-grained control
  input: LERNA_ROOT_PATH + '/node_modules/opentype.js/src/opentype.js',
  plugins: [
    nodeResolve(),
    commonjs(),
    {
      name: 'custom',
      transform(source, id) {
        // Exclude the rather large module that implements TrueType Hinting, as hinting is never
        // utilized in Troika's text rendering implementation. Saves 20KB or so in minified bundle.
        if (/hintingtt/.test(id)) {
          return 'export default function(){throw new Error("Hinting disabled")}'
        }

        // Remove all require('fs') references as we never run in Node and they tend to confuse
        // downstream bundlers.
        source = source.replace(/require\('fs'\)/g, '{}')

        return source
      }
    }
  ],
  output: {
    format: 'iife',
    name: 'opentype',
    file: 'libs/opentype.factory.js',
    banner,
    footer
  }
}