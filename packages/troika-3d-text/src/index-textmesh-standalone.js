// Exports for standalone TextMesh-only build:

export {
  configureTextBuilder,
  fontProcessorWorkerModule,
  preloadFont
} from './TextBuilder.js'

export {TextMesh} from './three/TextMesh.js'
export {GlyphsGeometry} from './three/GlyphsGeometry.js'
export {getCaretAtPoint, getSelectionRects} from './selectionUtils.js'
