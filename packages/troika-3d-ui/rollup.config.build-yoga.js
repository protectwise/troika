// This build file creates a static version of the Yoga library used for computing
// flexbox layouts. It's isolated within a "factory" function wrapper so it can
// easily be marshalled into a web worker.

import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'


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
  input: LERNA_ROOT_PATH + '/node_modules/yoga-layout/dist/entry-browser.js',
  plugins: [
    nodeResolve(),
    commonjs()
  ],
  output: {
    format: 'iife',
    name: 'Yoga',
    file: 'libs/yoga.factory.js',
    banner,
    footer
  }
}
