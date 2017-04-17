// Rollup plugins
import babel from 'rollup-plugin-babel'
import buble from 'rollup-plugin-buble'

export default {
  entry: 'src/index.js',
  plugins: [
    // babel({
    //   exclude: 'node_modules/**',
    //   runtimeHelpers: true
    // })
    buble()
  ],
  targets: [
    {
      format: 'umd',
      dest: 'build/troika.js',
      moduleName: 'Troika',
      globals: {
        easingjs: 'easing',
        'lodash-es': '_',
        react: 'React',
        three: 'THREE'
      }
    },
    {
      format: 'es',
      dest: 'build/troika.esmodule.js'
    }
  ]
}
