/* eslint-env worker */
'use strict'

// For Ammo.js WASM module https://github.com/kripken/ammo.js/issues/36
var Module = { TOTAL_MEMORY: 256 * 1024 * 1024 } // eslint-disable-line no-unused-vars

// Path relative to initial Worker script location
const ammoPath = '../../node_modules/ammo.js/builds/ammo.wasm.js'

// Hack to get the right path (relative to the Worker entry point) into the
// actual ammo.wasm.wasm loader script in ammo.wasm.js
self.document = {
  currentScript: {
    src: ammoPath
  }
}

importScripts(ammoPath)

delete self.document // Cleanup hack
