// Rollup plugins
import buble from 'rollup-plugin-buble'

export default {
  input: 'src/index.js',
  plugins: [
    // babel({
    //   exclude: 'node_modules/**',
    //   runtimeHelpers: true
    // })
    buble()
  ],
  output: [
    {
      format: 'umd',
      file: 'build/troika.js',
      name: 'Troika',
      globals: {
        easingjs: 'easing',
        'lodash-es': '_',
        react: 'React',
        three: 'THREE',
        'prop-types': 'T'
      }
    },
    {
      format: 'es',
      file: 'build/troika.esmodule.js'
    }
  ]
}
