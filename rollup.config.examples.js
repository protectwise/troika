// Rollup plugins
import babel from 'rollup-plugin-babel'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import replace from 'rollup-plugin-replace'
import importStrings from 'rollup-plugin-string'


export default {
  entry: 'examples/index.js',

  // TODO temporary workaround for lingering use of `exports` in three.modules.js: https://github.com/mrdoob/three.js/pull/9901
  intro: `var exports = {};`,

  plugins: [
    importStrings({
      include: '**/*.glsl',
    }),
    replace({
      'process.env.NODE_ENV': '"production"'
    }),
    babel({
      exclude: 'node_modules/**'
    }),
    commonjs({
      // non-CommonJS modules will be ignored, but you can also specifically include/exclude files
      // include: 'node_modules/**',  // Default: undefined
      // exclude: [ 'node_modules/foo/**', 'node_modules/bar/**' ],  // Default: undefined

      // search for files other than .js files (must already
      // be transpiled by a previous plugin!)
      extensions: [ '.js', '.jsx' ],  // Default: [ '.js' ]

      // if true then uses of `global` won't be dealt with by this plugin
      // ignoreGlobal: false,  // Default: false

      // if false then skip sourceMap generation for CommonJS modules
      sourceMap: false,  // Default: true

      // explicitly specify unresolvable named exports
      // (see below for more details)
      // namedExports: { './module.js': ['foo', 'bar' ] }  // Default: undefined
    }),
    nodeResolve({
      jsnext: true,
      main: true
    })
  ],
  format: 'iife',
  dest: 'build/examples-bundle.js'
}
