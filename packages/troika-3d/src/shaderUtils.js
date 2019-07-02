import {ShaderChunk, ShaderLib} from 'three'



export const voidMainRE = /\bvoid\s+main\s*\(\s*\)\s*{/g


// Copied from threejs WebGLPrograms.js so we can resolve builtin materials to their shaders
// TODO how can we keep this from getting stale?
const MATERIAL_TYPES_TO_SHADERS = {
  MeshDepthMaterial: 'depth',
  MeshDistanceMaterial: 'distanceRGBA',
  MeshNormalMaterial: 'normal',
  MeshBasicMaterial: 'basic',
  MeshLambertMaterial: 'lambert',
  MeshPhongMaterial: 'phong',
  MeshToonMaterial: 'phong',
  MeshStandardMaterial: 'physical',
  MeshPhysicalMaterial: 'physical',
  MeshMatcapMaterial: 'matcap',
  LineBasicMaterial: 'basic',
  LineDashedMaterial: 'dashed',
  PointsMaterial: 'points',
  ShadowMaterial: 'shadow',
  SpriteMaterial: 'sprite'
}


export function getShadersForMaterial(material) {
  let builtinType = MATERIAL_TYPES_TO_SHADERS[material.type]
  return builtinType ? ShaderLib[builtinType] : material //TODO fallback for unknown type?
}


// Copied from threejs WebGLProgram so we can pre-expand the shader includes
export function expandShaderIncludes( source ) {
  const pattern = /^[ \t]*#include +<([\w\d./]+)>/gm
  function replace(match, include) {
    let chunk = ShaderChunk[include]
    return chunk ? expandShaderIncludes(chunk) : match
  }
  return source.replace( pattern, replace )
}



// Find all uniforms and their types within a shader string
export function getUniformsTypes(shader) {
  let uniformRE = /\buniform\s+(int|float|vec[234])\s+([A-Za-z_][\w]*)/g
  let uniforms = Object.create(null)
  let match
  while ((match = uniformRE.exec(shader)) !== null) {
    uniforms[match[2]] = match[1]
  }
  return uniforms
}

