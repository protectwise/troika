import UIBlock3DFacade from '../UIBlock3DFacade.js'

class DatButtonFacade extends UIBlock3DFacade {
  constructor(parent) {
    super(parent)
    this.children = {
      facade: UIBlock3DFacade,
      borderRadius: '10%',
      backgroundColor: 0x333399,
      height: '100%',
      padding: [0, 0.02],
      alignItems: 'center',
      justifyContent: 'center',
      pointerStates: {
        hover: {
          backgroundColor: 0x6666cc
        }
      }
    }
  }

  afterUpdate () {
    this.children.text = this.label || 'Missing label'
    super.afterUpdate()
  }
}

export default DatButtonFacade
