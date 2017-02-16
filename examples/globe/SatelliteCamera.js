import {PerspectiveCamera3DFacade} from '../../src/index'



class SatelliteCamera extends PerspectiveCamera3DFacade {
  latitude = 0
  longitude = 0
  altitude = 10

  constructor() {

  }

  afterUpdate() {
    this.x = Math.cos(Math.PI * this.latitude / 180)
    this.y = Math.cos(Math.PI * this.latitude / 180)
  }
}

export default SatelliteCamera
