import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { GLTFFacade } from './GLTFFacade.js'

const MODEL_GEN = 'gen2'

function getModelUrl (gen, hand) {
  return `https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-${gen}-${hand}.gltf`
}

const MODEL_PARAMS = {
  gen1: {
    left: {
      url: getModelUrl('gen1', 'left'),
      transform: new Matrix4().compose(
        new Vector3(0, 0, -0.1),
        new Quaternion(),
        new Vector3(1, 1, 1)
      )
    },
    right: {
      url: getModelUrl('gen1', 'right'),
      transform: new Matrix4().compose(
        new Vector3(0, 0, -0.1),
        new Quaternion(),
        new Vector3(1, 1, 1)
      )
    }
  },
  gen2: {
    left: {
      url: getModelUrl('gen2', 'left'),
      transform: new Matrix4().compose(
        new Vector3(0.01, -0.01, -0.05),
        new Quaternion().setFromEuler(new Euler(-0.67, 0, 0)),
        new Vector3(1, 1, 1)
      )
    },
    right: {
      url: getModelUrl('gen2', 'right'),
      transform: new Matrix4().compose(
        new Vector3(-0.01, -0.01, -0.05),
        new Quaternion().setFromEuler(new Euler(-0.67, 0, 0)),
        new Vector3(1, 1, 1)
      )
    }
  }
}

// TODO define mapping here that will allow us to pass in a set of active button
//  ids and highlight their corresponding meshes when pressed...
// const buttonIdsToMeshNames = {}

class OculusTouchGrip extends GLTFFacade {
  /**
   * @property bodyColor
   * @property emissive
   * @property emissiveIntensity
   * @property buttonColor
   * @property buttonActiveColor
   */

  constructor (parent) {
    super(parent)

    this.xrInputSource = null
    this.bodyColor = 0x999999
    this.buttonColor = 0xffffff
    this.buttonActiveColor = 0xccffcc
    this.emissiveIntensity = 0.3
  }

  afterUpdate () {
    let hand = this.xrInputSource.handedness
    if (hand !== 'left' && hand !== 'right') {
      hand = 'left'
    }
    if (hand !== this._hand) {
      this._hand = hand
      this.url = MODEL_PARAMS[MODEL_GEN][hand].url
      this.rootTransform = MODEL_PARAMS[MODEL_GEN][hand].transform
    }

    this.updateMaterials()
    super.afterUpdate()
  }

  normalize (gltf) {
    // Track all the individual meshes
    this.meshes = Object.create(null)
    gltf.scene.traverse(obj => {
      if (obj.isMesh) {
        obj.material = obj.material.clone() //workaround for some meshes sharing a material instance
        this.meshes[obj.name] = obj
      }
    })
    return gltf
  }

  updateMaterials () {
    const { meshes } = this
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
}

export default OculusTouchGrip
