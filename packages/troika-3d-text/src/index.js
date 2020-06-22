// Proxy exports from troika-three-text for convenience:
export {
  configureTextBuilder,
  fontProcessorWorkerModule,
  preloadFont,
  Text as TextMesh,
  GlyphsGeometry,
  getCaretAtPoint,
  getSelectionRects
} from 'troika-three-text'

// Troika framework specific exports:
export {default as Text3DFacade} from './facade/Text3DFacade.js'
