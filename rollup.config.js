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



const builds = [
  // ES module file
  {
    input: 'src/index.js',
    output: {
      format: 'esm',
      file: `dist/${LERNA_PACKAGE_NAME}.esmodule.js`
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
      file: `dist/${LERNA_PACKAGE_NAME}.js`,
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
      file: `dist/${LERNA_PACKAGE_NAME}.min.js`,
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


export default builds










// const esmoduleMain = {
//   input: 'src/index.js',
//   plugins: [
//     buble()
//   ],
//   external,
//   output: {
//     format: 'es',
//     file: 'build/troika.esmodule.js'
//   }
// }
//
// const esmoduleMin = Object.assign({}, esmoduleMain, {
//   plugins: esmoduleMain.plugins.concat(closureCompiler()),
//   output: Object.assign({}, esmoduleMain.output, {file: 'build/troika.esmodule.min.js'})
// })
//
// const umdMain = {
//   input: 'src/index.js',
//   plugins: [
//     buble()
//   ],
//   external,
//   output: {
//     format: 'umd',
//     file: 'build/troika.js',
//     name: 'Troika',
//     globals: {
//       easingjs: 'easing',
//       react: 'React',
//       three: 'THREE',
//       'prop-types': 'T'
//     }
//   }
// }
//
// const umdMin = Object.assign({}, umdMain, {
//   plugins: umdMain.plugins.concat(closureCompiler()),
//   output: Object.assign({}, umdMain.output, {file: 'build/troika.min.js'})
// })
//
//
// export default [
//   esmoduleMain,
//   esmoduleMin,
//   umdMain,
//   umdMin
// ]
