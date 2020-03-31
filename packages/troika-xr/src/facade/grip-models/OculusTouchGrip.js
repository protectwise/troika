import { Object3DFacade } from 'troika-3d'
import { Group, Ray, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MODEL_GEN = 'gen2'

function getModelUrl(gen, hand) {
  return `https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-${gen}-${hand}.gltf`
}

const MODEL_PARAMS = {
  gen1: {
    left: {
      url: getModelUrl('gen1', 'left'),
      position: [0, 0, -0.1],
      rotation: [0, 0, 0]
    },
    right: {
      url: getModelUrl('gen1', 'right'),
      position: [0, 0, -0.1],
      rotation: [0, 0, 0]
    }
  },
  gen2: {
    left: {
      url: getModelUrl('gen2', 'left'),
      position: [0.01, -0.01, -0.05],
      rotation: [-0.67, 0, 0]
    },
    right: {
      url: getModelUrl('gen2', 'right'),
      position: [-0.01, -0.01, -0.05],
      rotation: [-0.67, 0, 0]
    }
  }
}

// TODO define mapping here that will allow us to pass in a set of active button
//  ids and highlight their corresponding meshes when pressed...
const buttonIdsToMeshNames = {

}



class OculusTouchGrip extends Object3DFacade {
  /**
   * @property bodyColor
   * @property emissive
   * @property emissiveIntensity
   * @property buttonColor
   * @property buttonActiveColor
   */

  constructor(parent) {
    super(parent, new Group())

    this.bodyColor = 0x999999
    this.buttonColor = 0xffffff
    this.buttonActiveColor = 0xccffcc
    this.emissiveIntensity = 0.3
  }

  afterUpdate() {
    let hand = this.xrInputSource.handedness
    if (hand !== 'left' && hand !== 'right') {
      hand = 'left'
    }
    if (hand !== this._hand) {
      this._hand = hand
      this.removeObjects()
      new GLTFLoader().load(
        MODEL_PARAMS[MODEL_GEN][hand].url,
        this.addObjects.bind(this),
        null,
        err => {
          console.error('Failed loading controller model', err)
        }
      )
    }

    this.updateMaterials()
    super.afterUpdate()
  }

  addObjects(gltf) {
    if (this.threeObject) {
      const root = this.rootObj = gltf.scene
      root.position.fromArray(MODEL_PARAMS[MODEL_GEN][this._hand].position)
      root.rotation.fromArray(MODEL_PARAMS[MODEL_GEN][this._hand].rotation)
      this.threeObject.add(root)

      // Find all the individual meshes
      this.meshes = Object.create(null)
      root.traverse(obj => {
        if (obj.isMesh) {
          obj.material = obj.material.clone() //workaround for some meshes sharing a material instance
          this.meshes[obj.name] = obj
        }
      })
      this.afterUpdate()
    }
  }

  removeObjects() {
    const {rootObj, meshes} = this
    if (rootObj) {
      this.threeObject.remove(rootObj)
      this.rootObj = null
    }
    if (meshes) {
      for (let name in meshes) {
        const {geometry, material} = meshes[name]
        geometry.dispose()
        if (material.texture) {
          material.texture.dispose()
        }
        material.dispose()
      }
      this.meshes = null
    }
  }

  updateMaterials() {
    const {meshes} = this
    if (meshes) {
      for (let name in meshes) {
        const color = name === 'body' ? this.bodyColor : this.buttonColor
        const material = meshes[name].material
        if (color !== material._lastColor) {
          material.color.set(color)
          material.emissive.set(color)
          material._lastColor = color
        }
        material.emissiveIntensity = this.emissiveIntensity
      }
    }
  }

  destructor () {
    this.removeObjects()
    super.destructor()
  }
}


export default OculusTouchGrip
