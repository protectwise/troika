import { Group3DFacade, Instanceable3DFacade, extendAsFlexNode, ListFacade } from '../../src/index'
import { BoxBufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three'


const cubeMaterial = new MeshStandardMaterial({roughness: 0.7, shininess: 0.7})
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
    let cubesData = []
    for (let x = 0; x < count; x++) {
      for (let y = 0; y < count; y++) {
        for (let z = 0; z < count; z++) {
          if (x*y*z === 0 || x === count-1 || y === count-1 || z === count-1) {
            cubesData.push({
              id: `${x}.${y}.${z}`,
              x: -0.5 + x / (count - 1),
              y: -0.5 + y / (count - 1),
              z: -0.5 + z / (count - 1),
              color: ((64 + x / count * 128) << 16) | ((64 + y / count * 128) << 8) | (64 + z / count * 128)
            })
          }
        }
      }
    }
    this.children = {
      facade: ListFacade,
      data: cubesData,
      template: {
        key: d => d.id,
        id: d => d.id,
        facade: Cube,
        x: d => this.selectedCubeId === d.id ? 0 : d.x,
        y: d => this.selectedCubeId === d.id ? 0 : d.y,
        z: d => this.selectedCubeId === d.id ? 0 : d.z,
        scale: d => this.selectedCubeId === d.id ? 1.3 : 1 / (count - 1) / 2,
        color: d => d.color,
        pointerStates: d => this.selectedCubeId ? {} : {
          hover: {
            color: 0xffffff,
            scale: 1 / (count - 1) / 1.6
          }
        },
        pointerEvents: true,
        transition: {
          x: {duration: 500, easing: 'easeOutBounce'},
          y: {duration: 500, easing: 'easeOutBounce'},
          z: {duration: 500, easing: 'easeOutBounce'},
          scale: {duration: 500, easing: 'easeOutBounce'},
          color: {interpolate: 'color', duration: 300}
        }
      }
    }

    this.onMouseOver = e => {
      this.onCubeOver(e.target.id)
    }
    this.onMouseOut = e => {
      this.onCubeOut(e.target.id)
    }
    this.onClick = e => {
      this.onCubeClick(e.target.id)
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
