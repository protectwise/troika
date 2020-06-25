import { Object3DFacade } from 'troika-3d'
import { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class GLTFFacade extends Object3DFacade {
  constructor (parent) {
    super(parent, new Group())
    this.url = null
    this.rootTransform = null
    this.autoDispose = true
  }

  afterUpdate () {
    let { url } = this
    if (url !== this._url) {
      this._url = url
      this.removeObjects()
      if (url) {
        let loader = new GLTFLoader()
        loader.setCrossOrigin('anonymous')
        loader.load(
          url,
          result => {
            this.onLoad(result)
          },
          null,
          err => {
            console.error('Failed loading controller model', err)
          }
        )
      }
    }
    super.afterUpdate()
  }

  onLoad (gltf) {
    if (this.threeObject) {
      gltf = this.normalize(gltf)
      let root = gltf.scene
      if (this.rootTransform) {
        root.applyMatrix4(this.rootTransform)
      }
      this.threeObject.add(root)
      root.updateMatrixWorld(true)
      this.gltf = gltf
      this.afterUpdate()
    }
  }

  normalize(gltf) {
    return gltf
  }

  removeObjects () {
    const { gltf } = this
    if (gltf && gltf.scene) {
      if (this.autoDispose) {
        gltf.scene.traverse(({ geometry, material }) => {
          if (geometry) {
            geometry.dispose()
          }
          if (material) {
            if (material.texture) {
              material.texture.dispose()
            }
            material.dispose()
          }
        })
      }
      if (this.threeObject) {
        this.threeObject.remove(gltf.scene)
      }
      this.gltf = null
    }
  }

  destructor () {
    this.removeObjects()
    super.destructor()
  }
}
