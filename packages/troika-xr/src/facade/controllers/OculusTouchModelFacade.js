import { Object3DFacade } from 'troika-3d'
import { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'


function getUrl(hand) {
  return `https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-${hand}.gltf`
}

// TODO define mapping here that will allow us to pass in a set of active button
//  ids and highlight their corresponding meshes when pressed...
const buttonIdsToMeshNames = {

}



class OculusTouchModelFacade extends Object3DFacade {
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
    let {hand} = this
    if (hand !== 'left' && hand !== 'right') hand = 'left'
    if (hand !== this._hand) {
      this._hand = hand
      new GLTFLoader().load(
        getUrl(hand),
        gltf => {
          const root = gltf.scene

          // Position/rotation adjustments to match actual controllers
          // TODO fine-tune these
          root.position.set(hand === 'left' ? -0.01 : 0.01, 0.04,-0.04)
          root.rotation.x = 0.7

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
        },
        null,
        err => {
          console.error('Failed loading controller model', err)
        }
      )
    }

    this.updateMaterials()
    super.afterUpdate()
  }

  updateMaterials() {
    const {meshes} = this
    if (meshes) {
      for (let name in meshes) {
        const color = name === 'body' ? this.bodyColor : this.buttonColor
        const material = meshes[name].material
        material.color.set(color)
        material.emissive.set(color)
        material.emissiveIntensity = this.emissiveIntensity
      }
    }
  }

  destructor () {
    const {meshes} = this
    if (meshes) {
      for (let name in meshes) {
        const {geometry, material} = meshes[name]
        geometry.dispose()
        if (material.texture) {
          material.texture.dispose()
        }
        material.dispose()
      }
    }
    super.destructor()
  }
}


export default OculusTouchModelFacade
