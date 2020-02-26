import React from 'react'
import ReactDOM from 'react-dom'
import { ParentFacade, utils } from 'troika-core'
import { HtmlOverlay3DFacade } from 'troika-3d'
import { DatGuiFacade } from 'troika-3d-ui'
import { WristMountedUI } from 'troika-xr'
import DatGui, {DatBoolean, DatSelect, DatNumber, DatButton} from 'react-dat-gui'


/**
 * Common widget for example configuration UI. Uses react-dat-gui on screen, and
 * our WebGL dat-gui implementation from `troika-3d-ui` when in XR.
 */
export class ExampleConfigurator extends ParentFacade {
  /**
   * @member {boolean} isXR
   * @member {object} data
   * @member {function} onUpdate
   */

  describeChildren () {
    if (this.isXR) {
      // In XR mode, use our WebGL dat-gui implementation and put it inside
      // the wrist-mounted UI container
      return {
        facade: WristMountedUI,
        children: {
          facade: BottomAnchoredDatGuiFacade,
          scale: 0.75,
          maxHeight: 0.48,
          overflow: 'scroll',
          items: [{
            type: 'button',
            label: 'Exit XR',
            onClick: () => {
              this.notifyWorld('endXRSession')
            }
          }].concat(this.items),
          data: this.data,
          onUpdate: this.onUpdate
        }
      }
    } else {
      // On screen, use react-dat-gui to avoid the perspective distortion at the
      // screen edge and so we don't have to worry about scaling. Renders into a
      // portal element so it isn't position-synced.
      return {
        facade: HtmlOverlay3DFacade,
        html: <ReactPortalContainer>
          <DatGui data={this.data} onUpdate={this.onUpdate}>
            {this.items.map((item, i) => {
              if (!item) { return null }
              item = utils.assign({key: i}, item)
              let Cmp = reactCmpMap[item.type]
              if (item.type === 'select') {
                item.optionLabels = []
                item.options = item.options.map(opt => {
                  if (opt && typeof opt === 'object') {
                    item.optionLabels.push(opt.label || opt.value)
                    return opt.value
                  } else {
                    item.optionLabels.push(opt)
                    return opt
                  }
                })
              }
              return <Cmp {...item} />
            })}
          </DatGui>
        </ReactPortalContainer>
      }
    }
  }
}

const reactCmpMap = {
  boolean: DatBoolean,
  button: DatButton,
  number: DatNumber,
  select: DatSelect
}

// Wrapper for the React version that renders to a portal outside the canvas that isn't
// subject to the HTMLOverlay3DFacade's positioning.
function ReactPortalContainer(props) {
  return ReactDOM.createPortal(
    props.children,
    document.getElementById('react-dat-gui-portal')
  )
}

// Aligns the DatGuiFacade to put its bottom-center point at its origin.
// Should make this a built-in `anchor` config for root `UIBlock3DFacade`s.
class BottomAnchoredDatGuiFacade extends DatGuiFacade {
  afterUpdate() {
    let {offsetWidth, offsetHeight} = this
    if (offsetWidth && offsetHeight) {
      this.x = -offsetWidth / 2 * this.scaleX
      this.y = offsetHeight * this.scaleY + 0.03
    }
    super.afterUpdate()
  }
}
