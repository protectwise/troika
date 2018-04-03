import { Group3DFacade, Instanceable3DFacade, extendAsFlexNode } from '../../src/index'
import { BoxBufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three'


const cubeMaterial = new MeshStandardMaterial()
cubeMaterial.instanceUniforms = ['diffuse']
const cubeMesh = new Mesh(
  new BoxBufferGeometry(1, 1, 1),
  cubeMaterial
)
class Cube extends Instanceable3DFacade {
  constructor(parent) {
    super(parent)
    this.color = 0x3ba7db
  }
  set color(c) {
    this.setInstanceUniform('diffuse', new Color(c))
    this._color = c
  }
  get color() {
    return this._color
  }
}
Cube.prototype.instancedThreeObject = cubeMesh


class CubeOfCubes extends Group3DFacade {
  constructor(parent) {
    super(parent)

    const count = 4
    let cubes = []
    for (let x = 0; x < count; x++) {
      for (let y = 0; y < count; y++) {
        for (let z = 0; z < count; z++) {
          if (x*y*z === 0 || x === count-1 || y === count-1 || z === count-1) {
            cubes.push({
              key: `${x}.${y}.${z}`,
              facade: Cube,
              x: -0.5 + x / (count - 1),
              y: -0.5 + y / (count - 1),
              z: -0.5 + z / (count - 1),
              scale: 1 / (count - 1) / 2,
              color: 0x3ba7db,
              pointerStates: {
                hover: {
                  color: 0xffffff,
                  scale: 1 / (count - 1) / 1.5
                }
              },
              transition: {
                scale: true,
                color: {interpolate: 'color', duration: 300}
              }
            })
          }
        }
      }
    }
    this.children = cubes

    this.onMouseOver = e => {
      this.onCubeOver()
    }
    this.onMouseOut = e => {
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
