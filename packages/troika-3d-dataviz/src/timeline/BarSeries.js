import { Group3DFacade, Instanceable3DFacade, ListFacade } from 'troika-3d'
import { BoxBufferGeometry, Mesh } from 'three'

const barMesh = new Mesh(
  new BoxBufferGeometry().translate(0, 0.5, -0.5)
)

class Bar extends Instanceable3DFacade {
  instancedThreeObject = barMesh
}

export class BarSeries extends Group3DFacade {
  /**
   * @type {{id, x, z, height}}
   */
  bars = null

  children = {
    facade: ListFacade,
    template: {
      key: (d, i) => d.id || i,
      facade: Bar,
      x: d => d.x,
      z: d => d.z,
      scaleX: d => this.barWidth,
      scaleY: d => d.height,
      scaleZ: d => this.barDepth
    }
  }
}
