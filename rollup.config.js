import buble from 'rollup-plugin-buble'
import closureCompiler from '@ampproject/rollup-plugin-closure-compiler'
import fs from 'fs'


/*

This is the primary shared Rollup configuration used for building most of Troika's
subpackages. To build all packages, make sure you're in the repository root and run:

  npm run build

*/


const { LERNA_PACKAGE_NAME, LERNA_ROOT_PATH } = process.env
if (!LERNA_PACKAGE_NAME || !LERNA_ROOT_PATH) {
  throw new Error("The build must be run by Lerna; please use `npm run build` from the repository root.")
}



// Names of all the packages
// These will be treated as externals when referenced as cross-package dependencies
const SIBLING_PACKAGES = fs.readdirSync(`${LERNA_ROOT_PATH}/packages`)


// Mapping of external package names to their globals for UMD build
const EXTERNAL_GLOBALS = SIBLING_PACKAGES.reduce((out, sib) => {
  out[sib] = sib.replace(/-/g, '_')
  return out
},{
  react: 'React',
  three: 'THREE',
  'three/examples/jsm/loaders/GLTFLoader': 'THREE.GLTFLoader',
  'three/examples/jsm/utils/BufferGeometryUtils': 'THREE.BufferGeometryUtils',
  'prop-types': 'PropTypes'
})


const onwarn = (warning, warn) => {
  // Quiet the 'Use of eval is strongly discouraged' warnings from Yoga lib
  // These are from the emscripten runtime so we can't do anything about them until Yoga
  // uses a newer versionof emscripten (https://github.com/kripken/emscripten/issues/5753)
  if (warning.code === 'EVAL' && /yoga\.factory\.js/.test(warning.id)) {
    return
  }
  warn(warning)
}


// Allow an individual package to define custom entry point(s) and output, via a
// json file in its root. If not present, uses a default.
let entries
const entriesPath = `${LERNA_ROOT_PATH}/packages/${LERNA_PACKAGE_NAME}/rollup.build-entries.js`
if (fs.existsSync(entriesPath)) {
  entries = require(entriesPath)
} else {
  entries = {
    'src/index.js': LERNA_PACKAGE_NAME
  }
}


const builds = []
for (let entry of Object.keys(entries)) {
  const outFilePrefix = entries[entry]
  builds.push(
    // ES module file
    {
      input: entry,
      output: {
        format: 'esm',
        file: `dist/${outFilePrefix}.esm.js`
      },
      external: Object.keys(EXTERNAL_GLOBALS),
      plugins: [
        buble()
      ],
      onwarn
    },
    // UMD file
    {
      input: entry,
      output: {
        format: 'umd',
        file: `dist/${outFilePrefix}.umd.js`,
        name: EXTERNAL_GLOBALS[LERNA_PACKAGE_NAME],
        globals: EXTERNAL_GLOBALS
      },
      external: Object.keys(EXTERNAL_GLOBALS),
      plugins: [
        buble()
      ],
      onwarn
    },
    // UMD file, minified
    {
      input: entry,
      output: {
        format: 'umd',
        file: `dist/${outFilePrefix}.umd.min.js`,
        name: EXTERNAL_GLOBALS[LERNA_PACKAGE_NAME],
        globals: EXTERNAL_GLOBALS
      },
      external: Object.keys(EXTERNAL_GLOBALS),
      plugins: [
        buble(),
        closureCompiler()
      ],
      onwarn
    }
  )
}


export default builds
