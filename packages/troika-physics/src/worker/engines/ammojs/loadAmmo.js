'use strict'

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