import Curve from '../curve-anim/Curve'
import { extendAsFlexNode, Group3DFacade } from '../../src/index'

class FlexboxLineGraph extends Group3DFacade {
  constructor(parent) {
    super(parent)

    const values = []
    for (let i = 0; i < 50; i++) {
      values.push(Math.random() * 10 + 5)
    }

    this.curveChildDef = {
      key: 'curve',
      facade: Curve,
      values
    }
  }

  afterUpdate() {
    if (this.offsetWidth) {
      const childDef = this.curveChildDef
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
