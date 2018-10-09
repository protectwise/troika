import Curve from '../curve-anim/Curve'
import {interpolateArray} from '../curve-anim/CurveAnimExample'
import { Group3DFacade } from 'troika-3d'
import { extendAsFlexNode } from 'troika-3d-ui'

class FlexboxLineGraph extends Group3DFacade {
  constructor(parent) {
    super(parent)

    this.curveChildDef = {
      key: 'curve',
      facade: Curve,
      values: [],
      transition: {
        values: {
          duration: 1000,
          easing: 'easeInOutCubic',
          interpolate: interpolateArray
        }
      }
    }
  }

  afterUpdate() {
    if (this.offsetWidth) {
      const childDef = this.curveChildDef
      childDef.values = this.values
      childDef.x = this.offsetLeft + this.clientLeft
      childDef.y = -(this.offsetTop + this.clientTop + this.clientHeight)
      childDef.width = this.clientWidth
      childDef.height = this.clientHeight
      childDef.strokeColor = childDef.fillColor = this.color
      childDef.renderOrder = this.flexNodeDepth + this.z
      this.children = childDef
    }
    super.afterUpdate()
  }
}

export default extendAsFlexNode(FlexboxLineGraph)
