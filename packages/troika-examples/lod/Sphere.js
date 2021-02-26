import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'

const MAX_DISTANCE = 50
const MIN_SEGMENTS = 6
const MAX_SEGMENTS = 24
const LOD_COUNT = 4


const LOD_GEOMETRIES = []
for (let i = 0; i < LOD_COUNT; i++) {
  let segments = Math.round(MAX_SEGMENTS - i * (MAX_SEGMENTS - MIN_SEGMENTS) / (LOD_COUNT - 1))
  LOD_GEOMETRIES.push({
    distance: i * MAX_DISTANCE / (LOD_COUNT - 1),
    geometry: new SphereBufferGeometry(1, segments, segments)
  })
}


const material = new MeshPhongMaterial({
  color: 0xcc3333,
  wireframe: true
})

export default class Sphere extends Object3DFacade {
  initThreeObject() {
    return new Mesh(LOD_GEOMETRIES[0], material.clone())
  }

  afterUpdate() {
    let distance = this.getCameraDistance()
    let geometry
    for (let i = 0; LOD_GEOMETRIES[i] && distance >= LOD_GEOMETRIES[i].distance; i++) {
      geometry = LOD_GEOMETRIES[i].geometry
    }
    if (geometry !== this.threeObject.geometry) {
      this.threeObject.geometry = geometry
    }
    this.threeObject.material.wireframe = this.wireframe
    super.afterUpdate()
  }


  // set levelOfDetail(lod) {
  //   // Parent will set LOD as range from 0 (furthest) to 1 (closest), and we'll choose
  //   // the appropriate geometry to use based on that.
  //   // 0 => MIN_SEGMENTS
  //   // 1 => MAX_SEGMENTS
  //   let segments = MIN_SEGMENTS + lod * (MAX_SEGMENTS - MIN_SEGMENTS)
  //   segments = Math.round(segments / SEGMENTS_STEP) * SEGMENTS_STEP
  //   let geometry = geometries[segments]
  //   if (geometry !== this.threeObject.geometry) {
  //     this.threeObject.geometry = geometry
  //   }
  // }
}
