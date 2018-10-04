// Rollup plugins
import buble from 'rollup-plugin-buble'
import closureCompiler from '@ampproject/rollup-plugin-closure-compiler'

const external = [
  'easingjs',
  'prop-types',
  'react',
  'three'
]

const esmoduleMain = {
  input: 'src/index.js',
  plugins: [
    buble()
  ],
  external,
  output: {
    format: 'es',
    file: 'build/troika.esmodule.js'
  }
}

const esmoduleMin = Object.assign({}, esmoduleMain, {
  plugins: esmoduleMain.plugins.concat(closureCompiler()),
  output: Object.assign({}, esmoduleMain.output, {file: 'build/troika.esmodule.min.js'})
})

const umdMain = {
  input: 'src/index.js',
  plugins: [
    buble()
  ],
  external,
  output: {
    format: 'umd',
    file: 'build/troika.js',
    name: 'Troika',
    globals: {
      easingjs: 'easing',
      react: 'React',
      three: 'THREE',
      'prop-types': 'T'
    }
  }
}

const umdMin = Object.assign({}, umdMain, {
  plugins: umdMain.plugins.concat(closureCompiler()),
  output: Object.assign({}, umdMain.output, {file: 'build/troika.min.js'})
})


export default [
  esmoduleMain,
  esmoduleMin,
  umdMain,
  umdMin
]
