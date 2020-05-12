// 3D text exports

export {
  configureTextBuilder,
  fontProcessorWorkerModule,
  preloadFont
} from './TextBuilder.js'

export {TextMesh} from './three/TextMesh.js'
export {GlyphsGeometry} from './three/GlyphsGeometry.js'
export {getCaretAtPoint, getSelectionRects} from './selectionUtils.js'

export {default as Text3DFacade} from './facade/Text3DFacade.js'
