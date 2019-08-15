import { ListFacade } from 'troika-core'
import { Group3DFacade, Instanceable3DFacade } from 'troika-3d'
import { extendAsFlexNode } from 'troika-3d-ui'
import { BoxBufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three'


const cubeMaterial = new MeshStandardMaterial({roughness: 0.7, metalness: 0.7})
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


const anim = {
  from: {rotateX: -Math.PI, rotateY: -Math.PI, rotateZ: -Math.PI},
  to: {rotateX: Math.PI, rotateY: Math.PI, rotateZ: Math.PI},
  duration: 10000,
  iterations: Infinity
}
const animPaused = Object.assign({paused: true}, anim)


class CubeOfCubes extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this.selectedColor = null

    const count = 4
    let cubesData = []
    for (let x = 0; x < count; x++) {
      for (let y = 0; y < count; y++) {
        for (let z = 0; z < count; z++) {
          if (x*y*z === 0 || x === count-1 || y === count-1 || z === count-1) {
            cubesData.push({
              color: ((64 + x / count * 128) << 16) | ((64 + y / count * 128) << 8) | (64 + z / count * 128),
              x: -0.5 + x / (count - 1),
              y: -0.5 + y / (count - 1),
              z: -0.5 + z / (count - 1)
            })
          }
        }
      }
    }
    this.children = this._childDef = {
      facade: Group3DFacade,
      animation: anim,
      children: {
        facade: ListFacade,
        data: cubesData,
        template: {
          key: d => d.color,
          facade: Cube,
          color: d => d.color,
          x: d => this.selectedColor === d.color ? 0 : d.x,
          y: d => this.selectedColor === d.color ? 0 : d.y,
          z: d => this.selectedColor === d.color ? 0 : d.z,
          scale: d => this.selectedColor === d.color ? 1.3 : 1 / (count - 1) / 2,
          pointerStates: d => this.selectedColor ? {} : {
            hover: {
              //color: 0xffffff,
              scale: 1 / (count - 1) / 1.6
            }
          },
          pointerEvents: true,
          transition: {
            x: {duration: 500, easing: 'easeOutBounce'},
            y: {duration: 500, easing: 'easeOutBounce'},
            z: {duration: 500, easing: 'easeOutBounce'},
            scale: {duration: 500, easing: 'easeOutBounce'}
          }
        }
      }
    }

    this.onMouseOver = e => {
      this.hovering = true
      this.afterUpdate()
    }
    this.onMouseOut = e => {
      this.hovering = false
      this.afterUpdate()
    }
    this.onClick = e => {
      this.onSelectColor(e.target.color)
    }
  }

  afterUpdate() {
    const childDef = this._childDef
    this.threeObject.visible = this.offsetWidth != null
    childDef.animation = (this.hovering) ? animPaused : anim

    // Center within the layed out box
    this.x = this.offsetLeft + this.offsetWidth / 2
    this.y = -(this.offsetTop + this.offsetHeight / 2)
    childDef.scale = Math.min(this.clientWidth, this.clientHeight) / Math.sqrt(2)
    super.afterUpdate()
  }
}

export default extendAsFlexNode(CubeOfCubes)
