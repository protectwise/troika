/* eslint-env worker */
'use strict'

// Source: https://stackoverflow.com/a/47880734
const supportsWasm = () => {
  try {
    if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
      const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00))
      if (module instanceof WebAssembly.Module) {
        return new WebAssembly.Instance(module) instanceof WebAssembly.Instance
      }
    }
  } catch (e) {
  }
  return false
}

// For Ammo.js WASM module https://github.com/kripken/ammo.js/issues/36
var Module = { TOTAL_MEMORY: 256 * 1024 * 1024 } // eslint-disable-line no-unused-vars

// Path relative to initial Worker script location
// const ammoPath = '../../node_modules/ammo.js/builds/ammo.wasm.js'
// const ammoPath = '../../node_modules/ammo.js/builds/ammo.js'
const ammoPath = supportsWasm() ? '../../libs/troika-ammo.wasm.js' : '../../libs/troika-ammo.js'

// Hack to get the right path (relative to the Worker entry point) into the
// actual ammo.wasm.wasm loader script in ammo.wasm.js
// self.document = {
//   currentScript: {
//     src: ammoPath
//   }
// }

importScripts(ammoPath)

delete self.document // Cleanup hack
