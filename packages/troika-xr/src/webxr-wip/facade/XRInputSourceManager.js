import {utils, ParentFacade} from 'troika-core'
import XRInputSourceFacade from './XRInputSourceFacade'


/*

Additive or replace?


{
  key: 'primaryTool',
  facade: XRInputSourceAnchored,
  selector: xrInputSource => (
    xrInputSource.targetRayMode === 'tracked-pointer' &&
    xrInputSource.handedness === prefs.handedness
  ),
  referenceSpace: 'grip'
},
{
  key: 'xrInputDefaultGrips',
  facade: XRInputVendorGrips
},
{
  facade: TrackedPointerXRInputSource,
  matches: (xrInputSource, allSources) => (
    xrInputSource.handedness === 'left'
  ),

  onSelectStart: e => {},
  onSelect: e => {},
  onSelectEnd: e => {},
  onSqueezeStart: e => {},
  onSqueeze: e => {},
  onSqueezeEnd: e => {},

  onButtonDown: e => {},
  onButtonClick: e => {},
  onButtonUp: e => {},
  onAxisChange: e => {},

  targetRay: true,
  targetRay: {facade: MyCustomLaser},
  targetRay: {color: 0x33ff33},
  cursor: true,
  cursor: {facade: MyCustomCursor},
  cursor: {color: 0xff0000},
  grip: true,
  grip: {facade: PlatformGripModel},
  grip: {
    facade: Group3DFacade,
    children: [{
      key: 'main',
      facade: PlatformGripModel
    }, {
      key: 'ui',
      facade: GripTabletFacade,
      visible: state.
    }]
  }
}



{
  facade: XRInputSourceConfig,
  configs: [
    {
      match: src => src.targetRayMode === 'tracked-pointer' && src.handedness === 'left'
    }
  ]
}



---

For each XRInputSource:
  - Resolve a XRInputSourceFacade
    - based on...?
  - Find objects in scene matching the XRInputSource
    - based on: targetRayMode, handedness, profiles, ...?
    - if none found, supply a default set



*/



/**
 * A container facade, placed at the root of the scene, that manages the tracking of
 * `XRInputSource`s and the rendering of their related scene objects.
 *
 *
 */
export class XRInputSourceManager extends ParentFacade {
  constructor(parent) {
    super(parent)
    this._sourcesDirty = true

    // Required props:
    this.xrSession = null
    this.xrReferenceSpace = null

    // Separate subtree for the XRInputSourceFacade instances:
    this._xrInputSourceSubtree = new ParentFacade(this)

    this._onInputSourcesChange = e => {
      this._sourcesDirty = true
      this.afterUpdate()
    }
  }

  afterUpdate() {
    const {xrSession, _lastXrSession} = this

    if (xrSession !== _lastXrSession) {
      this._lastXrSession = xrSession
      if (_lastXrSession) {
        _lastXrSession.removeEventListener('inputsourceschange', this._onInputSourcesChange)
      }
      if (xrSession) {
        xrSession.addEventListener('inputsourceschange', this._onInputSourcesChange)
      }
    }

    if (this._sourcesDirty) {
      this._sourcesDirty = false
      const inputSources = xrSession && xrSession.inputSources
      this._xrInputSourceSubtree.children = inputSources && inputSources.map(xrInputSource => {
        // TODO resolve config overrides?
        return {
          facade: XRInputSourceFacade,
          key: utils.getIdForObject(xrInputSource),
          xrInputSource,
          xrSession: this.xrSession,
          xrReferenceSpace: this.xrReferenceSpace
        }
      })
      this._xrInputSourceSubtree.afterUpdate()
    }
    super.afterUpdate()
  }

  /**
   * Override
   */
  updateMatrices() {

  }

  destructor () {
    if (this.xrSession) {
      this.xrSession.removeEventListener('inputsourceschange', this._onInputSourcesChange)
    }
    super.destructor()
    this._xrInputSourceSubtree.destructor()
  }
}

