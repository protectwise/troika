// Exports for troika-three-text.webgpu package:
//
// A drop-in for the main entry: swap `from 'troika-three-text'` for
// `from 'troika-three-text/webgpu'` and the same names keep working.
//
// This build carries its own copy of the text builder, so the helpers below must come from
// here: importing them from 'troika-three-text' instead would configure (or preload fonts
// into) a copy that WebGPUText never uses, and silently have no effect.

export { WebGPUText, WebGPUText as Text } from './WebGPUText.js'
export { createTextDerivedNodeMaterial } from './TextDerivedNodeMaterial.js'
export { configureTextBuilder, getTextRenderInfo, typesetterWorkerModule, preloadFont, dumpSDFTextures } from '../TextBuilder.js'
export { fontResolverWorkerModule } from '../FontResolver.js'
export { GlyphsGeometry } from '../GlyphsGeometry.js'
export { getCaretAtPoint, getSelectionRects } from '../selectionUtils.js'

// Deliberately absent: BatchedText, which isn't ported to WebGPU yet, and
// createTextDerivedMaterial, which builds GLSL that WebGPURenderer can't run.
