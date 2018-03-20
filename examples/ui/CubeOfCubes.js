import { Group3DFacade, Instanceable3DFacade, extendAsFlexNode } from '../../src/index'
import { BoxBufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three'


const cubeMaterial = new MeshStandardMaterial()
cubeMaterial.instanceUniforms = ['diffuse']
const cubeMesh = new Mesh(
  new BoxBufferGeometry(1, 1, 1).translate(0.5, 0.5, 0.5),
  cubeMaterial
)
class Cube extends Instanceable3DFacade {
  constructor(parent) {
    super(parent)
    this.color = 0x3ba7db
  }
  set color(c) {
    this.setInstanceUniform('diffuse', new Color(c))
  }
}
Cube.prototype.instancedThreeObject = cubeMesh


class CubeOfCubes extends Group3DFacade {
  constructor(parent) {
    super(parent)

    const count = 5
    let cubes = []
    for (let x = 0; x < count; x++) {
      for (let y = 0; y < count; y++) {
        for (let z = 0; z < count; z++) {
          cubes.push({
            key: `${x}.${y}.${z}`,
            facade: Cube,
            x: -0.5 + x / count,
            y: -0.5 + y / count,
            z: -0.5 + z / count,
            scaleX: 1 / count / 2,
            scaleY: 1 / count / 2,
            scaleZ: 1 / count / 2,
            pointerEvents: true //bubbles
          })
        }
      }
    }
    this.children = cubes

    this.onMouseOver = e => {
      e.target.color = 0xffffff
      this.onCubeOver()
    }
    this.onMouseOut = e => {
      e.target.color = 0x3ba7db
      this.onCubeOut()
    }
  }

  afterUpdate() {
    this.threeObject.visible = this.offsetWidth != null

    // Center within the layed out box
    this.x = this.offsetLeft + this.offsetWidth / 2
    this.y = -(this.offsetTop + this.offsetHeight / 2)
    this.scaleX = this.scaleY = this.scaleZ = Math.min(this.clientWidth, this.clientHeight) / Math.sqrt(2)
    super.afterUpdate()
  }
}

export default extendAsFlexNode(CubeOfCubes)
