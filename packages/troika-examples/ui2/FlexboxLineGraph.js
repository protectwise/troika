import LineGraph from './LineGraph'
import { Group3DFacade } from 'troika-3d'
import { extendAsFlexNode } from 'troika-3d-ui'


function interpolateArray(fromValue, toValue, progress) {
  let interpolated = new Float32Array(toValue.length)
  for (let i = interpolated.length; i--; ) {
    let from = i < fromValue.length ? fromValue[i] : 0
    interpolated[i] = from + (toValue[i] - from) * progress
  }
  return interpolated
}



class FlexboxLineGraph extends Group3DFacade {
  constructor(parent) {
    super(parent)

    this.curveChildDef = {
      key: 'curve',
      facade: LineGraph,
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
      this.x = this.offsetLeft + this.clientLeft
      this.y = -(this.offsetTop + this.clientTop + this.clientHeight)
      childDef.width = this.clientWidth
      childDef.height = this.clientHeight
      childDef.strokeColor = childDef.fillColor = this.color
      childDef.renderOrder = this.flexNodeDepth
      this.children = childDef
    }
    super.afterUpdate()
  }
}

export default extendAsFlexNode(FlexboxLineGraph)
