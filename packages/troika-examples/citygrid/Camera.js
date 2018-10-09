import {PerspectiveCamera3DFacade} from 'troika-3d'

class GridCamera extends PerspectiveCamera3DFacade {
  constructor(...args) {
    super(...args)
    this.fov = 75
    this.near = 0.1
    this.far = 1000
  }

  afterUpdate() {
    this.x = this.distance * Math.sin(this.angle)
    this.y = this.distance * Math.cos(this.angle)
    this.z = this.elevation

    super.afterUpdate()
  }
}

export default GridCamera
