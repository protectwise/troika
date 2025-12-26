import buble from 'rollup-plugin-buble'
import terser from '@rollup/plugin-terser'
import fs from 'fs'


/*

This is the primary shared Rollup configuration used for building most of Troika's
subpackages. To build all packages, make sure you're in the repository root and run:

  npm run build

Configuration optimized for Rollup 4.x with improved tree-shaking and bundle sizes.

*/


const { LERNA_PACKAGE_NAME, LERNA_ROOT_PATH, ROLLUP_WATCH } = process.env
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
  'bidi-js': 'bidi_js',
  'webgl-sdf-generator': 'webgl_sdf_generator',
  'three/examples/jsm/loaders/GLTFLoader.js': 'THREE.GLTFLoader',
  'prop-types': 'PropTypes',
  'object-path': 'objectPath'
})

// Some packages (e.g. those with worker code) we want to transpile in the ESM
// in addition to the UMD:
// TODO make this more fine-grained than the whole package
const TRANSPILE_PACKAGES = [
  'troika-worker-utils'
]


const onwarn = (warning, warn) => {
  // Quiet the 'Use of eval is strongly discouraged' warnings from Yoga lib
  // These are from the emscripten runtime so we can't do anything about them until Yoga
  // uses a newer versionof emscripten (https://github.com/kripken/emscripten/issues/5753)
  if (warning.code === 'EVAL' && /yoga\.factory\.js/.test(warning.id)) {
    return
  }
  // Suppress circular dependency warnings in test/example environments
  if (warning.code === 'CIRCULAR_DEPENDENCY' && ROLLUP_WATCH) {
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
    // ES module file - optimized for tree-shaking
    {
      input: entry,
      output: {
        format: 'esm',
        file: `dist/${outFilePrefix}.esm.js`,
        preserveModules: false
      },
      external: Object.keys(EXTERNAL_GLOBALS),
      plugins: [
        TRANSPILE_PACKAGES.includes(LERNA_PACKAGE_NAME) ? buble() : null
      ],
      onwarn,
      perf: true
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
        TRANSPILE_PACKAGES.includes(LERNA_PACKAGE_NAME) ? buble() : null
      ],
      onwarn,
      perf: true
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
        TRANSPILE_PACKAGES.includes(LERNA_PACKAGE_NAME) ? buble() : null,
        terser()
      ],
      onwarn,
      perf: true
    }
  )
}


export default builds
