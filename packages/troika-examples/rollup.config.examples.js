// Rollup plugins
import buble from 'rollup-plugin-buble'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import replace from 'rollup-plugin-replace'
import importStrings from 'rollup-plugin-string'
import importJson from 'rollup-plugin-json'
import serve from 'rollup-plugin-serve'


export default {
  input: 'index.js',

  plugins: [
    importStrings({
      include: '**/*.glsl',
    }),
    importJson(),
    replace({
      'process.env.NODE_ENV': '"production"'
    }),
    // babel({
    //   exclude: 'node_modules/**',
    //   runtimeHelpers: true
    // }),
    buble(),
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
      main: true,
      browser: true
    }),
    serve({
      //open: true,
      contentBase: ''
    })
  ],
  output: {
    format: 'iife',
    file: 'dist/examples-bundle.js'
  }
}
