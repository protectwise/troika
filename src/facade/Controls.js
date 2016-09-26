import {FlyControls} from 'three/examples/js/controls/FlyControls'
import FacadeBase from './FacadeBase'

// Common superclass with setters for all possible light properties
class Controls extends FacadeBase {
}


// Setters for simple properties to be copied
/*
['intensity', 'distance', 'angle', 'penumbra', 'decay'].forEach(propName => {
  Object.defineProperty(Light.prototype, propName, {
    get() {
      return this.threeObject[propName]
    },
    set(value) {
      this.threeObject[propName] = value
    }
  })
})
*/


function createControlsSubclass(ThreeJsControlsClass) {
  return class extends Controls {
    constructor(world) {
      super(world)
    }
  }
}


export const FlyControls = createControlsSubclass(THREE.FlyControls)
export const OrbitControls = createControlsSubclass(THREE.OrbitControls)
export const TrackballControls = createControlsSubclass(THREE.TrackballControls)
