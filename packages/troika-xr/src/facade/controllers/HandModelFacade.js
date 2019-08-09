import { Object3DFacade } from 'troika-3d'
import { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'


function getUrl(hand) {
  return `https://cdn.aframe.io/controllers/hands/${hand}Hand.glb`
}



class HandModelFacade extends Object3DFacade {
  /**
   * @property color
   * @property emissive
   * @property emissiveIntensity
   */

  constructor(parent) {
    super(parent, new Group())

    this.color = 0x999999
    this.emissive = 0x333333
    this.emissiveIntensity = 0.1
    this.opacity = 1
  }

  afterUpdate() {
    let {hand} = this
    if (hand !== 'left' && hand !== 'right') hand = 'left'
    if (hand !== this._hand) {
      this._hand = hand
      new GLTFLoader().load(
        getUrl(hand),
        gltf => {
          const root = gltf.scene.children[0]
          this.threeObject.add(root)
          // Find the actual mesh object and save a reference
          root.traverse(obj => {
            if (obj.isSkinnedMesh) {
              this.handMesh = obj
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

    this.updateMaterial()
    super.afterUpdate()
  }

  updateMaterial() {
    const {handMesh} = this
    if (handMesh) {
      const {material} = handMesh
      material.transparent = (material.opacity = this.opacity) < 1
      material.color.set(this.color)
      material.emissive.set(this.emissive)
      material.emissiveIntensity = this.emissiveIntensity
    }
  }
}


export default HandModelFacade
