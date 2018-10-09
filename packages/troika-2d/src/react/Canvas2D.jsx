import { utils } from 'troika-core'
import T from 'prop-types'
import World2DFacade from '../facade/World2DFacade'
import { ReactCanvasBase } from 'troika-core'

class Canvas2D extends ReactCanvasBase {
  initWorld (canvas) {
    let world = new World2DFacade(canvas)
    world.renderHtmlItems = this.renderHtmlItems
    return world
  }

  updateWorld (world) {
    let props = this.props
    world.width = props.width
    world.height = props.height
    world.pixelRatio = props.pixelRatio
    world.backgroundColor = props.backgroundColor
    world.onBackgroundClick = props.onBackgroundClick
    world.objects = props.objects
    world.continuousRender = props.continuousRender
    world.onStatsUpdate = props.stats ? this.updateStats : null
    world.afterUpdate()
  }
}

Canvas2D.displayName = 'Canvas2D'

Canvas2D.propTypes = utils.assignIf(
  {
    backgroundColor: T.any,
    objects: T.oneOfType([T.array, T.object]).isRequired,
    onBackgroundClick: T.func
  },
  ReactCanvasBase.commonPropTypes
)

export default Canvas2D
