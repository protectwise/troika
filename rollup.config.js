import buble from 'rollup-plugin-buble'
import closureCompiler from '@ampproject/rollup-plugin-closure-compiler'



/*

This is the primary shared Rollup configuration used for building most of Troika's
subpackages. To build all packages, make sure you're in the repository root and run:

  npm run build

*/


const { LERNA_PACKAGE_NAME, LERNA_ROOT_PATH } = process.env
if (!LERNA_PACKAGE_NAME || !LERNA_ROOT_PATH) {
  throw new Error("The build must be run by Lerna; please use `npm run build` from the repository root.")
}



// Names of all the packages to build
// TODO build this dynamically from filesystem?
const SIBLING_PACKAGES = [
  'troika-animation',
  'troika-core',
  'troika-2d',
  'troika-3d',
  'troika-3d-text',
  'troika-3d-ui',
]

// Mapping of external package names to their globals for UMD build
const EXTERNAL_GLOBALS = SIBLING_PACKAGES.reduce((out, sib) => {
  out[sib] = sib.replace(/-/g, '_')
  return out
},{
  easingjs: 'easing',
  react: 'React',
  three: 'THREE',
  'prop-types': 'PropTypes'
})



export default [
  // ES module file
  {
    input: 'src/index.js',
    output: {
      format: 'esm',
      file: `dist/${LERNA_PACKAGE_NAME}.esm.js`
    },
    external: Object.keys(EXTERNAL_GLOBALS),
    plugins: [
      buble()
    ]
  },
  // UMD file
  {
    input: 'src/index.js',
    output: {
      format: 'umd',
      file: `dist/${LERNA_PACKAGE_NAME}.umd.js`,
      name: EXTERNAL_GLOBALS[LERNA_PACKAGE_NAME],
      globals: EXTERNAL_GLOBALS
    },
    external: Object.keys(EXTERNAL_GLOBALS),
    plugins: [
      buble()
    ]
  },
  // UMD file, minified
  {
    input: 'src/index.js',
    output: {
      format: 'umd',
      file: `dist/${LERNA_PACKAGE_NAME}.umd.min.js`,
      name: EXTERNAL_GLOBALS[LERNA_PACKAGE_NAME],
      globals: EXTERNAL_GLOBALS
    },
    external: Object.keys(EXTERNAL_GLOBALS),
    plugins: [
      buble(),
      closureCompiler()
    ]
  }
]
