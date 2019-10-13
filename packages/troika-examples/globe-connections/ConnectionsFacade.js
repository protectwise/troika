import {Group3DFacade} from 'troika-3d'
import Bezier3DFacade from '../bezier-3d/Bezier3DFacade'
import {Vector3} from 'three'


const colors = ["#68affc", "#a3d71e", "#b735e8", "#5df23e", "#cf80dd", "#50942f", "#74398b", "#a0d48d", "#eb36a0", "#47f0a3"]
// [
//   0x00876c,
//   0xffff9d,
//   0x3d9c73,
//   0xfee17e,
//   0x63b179,
//   0xfcc267,
//   0x88c580,
//   0xd43d51,
//   0xaed987,
//   0xef8250,
//   0xd6ec91,
//   0xf7a258,
//   0xe4604e,
// ]


class ConnectionsFacade extends Group3DFacade {
  constructor(parent) {
    super(parent)

    this.onBeforeRender = () => {
      const {globe, cities} = this
      const cxns = []
      if (globe && cities && !globe.isDestroying && !cities.isDestroying) {
        cities.forEachChild((cityLabel, i) => {
          const {offsetHeight, offsetTop, parentFlexNode} = cityLabel
          if (cityLabel.visible && offsetHeight && !cityLabel.isFullyClipped &&
            (offsetTop + offsetHeight / 2 > parentFlexNode.scrollTop) &&
            (offsetTop + offsetHeight / 2 < parentFlexNode.scrollTop + parentFlexNode.clientHeight)
          ) {
            const labelY = offsetHeight / 2
            const labelPos = cityLabel.threeObject.localToWorld(new Vector3(0.005, -labelY, 0))
            const labelCtrl = cityLabel.threeObject.localToWorld(new Vector3(-0.2, -labelY, 0))
            const {lat, lng, hovering} = cityLabel
            const globePos = globe.latLonToWorldPosition(lat, lng, 1)
            const globeCtrl = globe.latLonToWorldPosition(lat, lng, 4)
            // globeCtrl.y = globeCtrl.y > 0 ? 3 : -3
            // globeCtrl.applyMatrix4(globe.threeObject.matrixWorld)
            cxns.push({
              key: cityLabel.$facadeId,
              facade: Bezier3DFacade,
              radius: hovering ? 0.0015 : 0.001,
              color: hovering ? 0xffffff : colors[i % colors.length],
              opacity: hovering ? 1.0 : 0.6,
              p1x: globePos.x,
              p1y: globePos.y,
              p1z: globePos.z,
              c1x: globeCtrl.x,
              c1y: globeCtrl.y,
              c1z: globeCtrl.z,
              c2x: labelCtrl.x,
              c2y: labelCtrl.y,
              c2z: labelCtrl.z,
              p2x: labelPos.x,
              p2y: labelPos.y,
              p2z: labelPos.z,
              dashArray: hovering ? [0.01, 0.01] : null,
              animation: hovering ? {
                from: {dashOffset: 0},
                to: {dashOffset: -0.02},
                duration: 200,
                iterations: Infinity
              } : null
            })
          }
        })
      }
      this.children = cxns
      this.afterUpdate()
    }
  }

  // shouldUpdateChildren () {
  //   return false //will update children manually in onBeforeRender
  // }
}

export default ConnectionsFacade
