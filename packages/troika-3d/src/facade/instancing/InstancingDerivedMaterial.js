import { createDerivedMaterial, getShaderUniformTypes, voidMainRegExp } from 'troika-three-utils'

const inverseFunction = `
#if __VERSION__ < 300
// matrix inversion utility for pre-ES3 - credit https://github.com/stackgl/glsl-inverse
mat3 inverse(mat3 m) {
  float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
  float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
  float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

  float b01 = a22 * a11 - a12 * a21;
  float b11 = -a22 * a10 + a12 * a20;
  float b21 = a21 * a10 - a11 * a20;

  float det = a00 * b01 + a01 * b11 + a02 * b21;

  return mat3(
    b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
    b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
    b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)
  ) / det;
}
#endif
`

const vertexCommonDefs = `
attribute vec4 troika_modelMatrixRow0;
attribute vec4 troika_modelMatrixRow1;
attribute vec4 troika_modelMatrixRow2;
mat4 troika_modelMatrix;
mat4 troika_modelViewMatrix;
mat3 troika_normalMatrix;
`

const modelMatrixVarAssignment = `
troika_modelMatrix = mat4(
  %0.x, %1.x, %2.x, 0.0,
  %0.y, %1.y, %2.y, 0.0,
  %0.z, %1.z, %2.z, 0.0,
  %0.w, %1.w, %2.w, 1.0
);
`.replace(/%/g, 'troika_modelMatrixRow')

const modelViewMatrixVarAssignment = `
troika_modelViewMatrix = viewMatrix * troika_modelMatrix;
`

const normalMatrixVarAssignment = `
troika_normalMatrix = transposeMat3(inverse(mat3(troika_modelViewMatrix)));
`


const modelMatrixRefRE = /\bmodelMatrix\b/g
const modelViewMatrixRefRE = /\bmodelViewMatrix\b/g
const normalMatrixRefRE = /\bnormalMatrix\b/g
const precededByUniformRE = /\buniform\s+(int|float|vec[234])\s+$/
const attrRefReplacer = (name, index, str) => precededByUniformRE.test(str.substr(0, index)) ? name : `troika_${name}`
const varyingRefReplacer = (name, index, str) => precededByUniformRE.test(str.substr(0, index)) ? name : `troika_vary_${name}`

const CACHE = new WeakMap()

/**
 * Get a derived material with instancing upgrades for the given base material.
 * The result is cached by baseMaterial+instanceUniforms so we always get the same instance
 * back rather than getting a clone each time and having to re-upgrade every frame.
 */
export function getInstancingDerivedMaterial(baseMaterial) {
  let {instanceUniforms} = baseMaterial
  let instanceUniformsKey = instanceUniforms ? instanceUniforms.sort().join('|') : ''
  let derived = CACHE.get(baseMaterial)
  if (!derived || derived._instanceUniformsKey !== instanceUniformsKey) {
    derived = createDerivedMaterial(baseMaterial, {
      defines: {
        TROIKA_INSTANCED_UNIFORMS: instanceUniformsKey
      },
      customRewriter({vertexShader, fragmentShader}) {
        return upgradeShaders(vertexShader, fragmentShader, instanceUniforms)
      }
    })
    derived._instanceUniformsKey = instanceUniformsKey
    CACHE.set(baseMaterial, derived)
  }
  return derived
}


/**
 * Transform the given vertex and fragment shader pair so they accept instancing
 * attributes for the builtin matrix uniforms as well as any other uniforms that
 * have been declared as instanceable.
 */
export function upgradeShaders(vertexShader, fragmentShader, instanceUniforms=[]) {
  // See what gets used
  let usesModelMatrix = modelMatrixRefRE.test(vertexShader)
  let usesModelViewMatrix = modelViewMatrixRefRE.test(vertexShader)
  let usesNormalMatrix = normalMatrixRefRE.test(vertexShader)

  // Find what uniforms are declared in which shader and their types
  let vertexUniforms = getShaderUniformTypes(vertexShader)
  let fragmentUniforms = getShaderUniformTypes(fragmentShader)

  let vertexDeclarations = [vertexCommonDefs]
  let vertexAssignments = []
  let fragmentDeclarations = []

  // Add variable assignments for, and rewrite references to, builtin matrices
  if (usesModelMatrix || usesModelViewMatrix || usesNormalMatrix) {
    vertexShader = vertexShader.replace(modelMatrixRefRE, attrRefReplacer)
    vertexAssignments.push(modelMatrixVarAssignment)
  }
  if (usesModelViewMatrix || usesNormalMatrix) {
    vertexShader = vertexShader.replace(modelViewMatrixRefRE, attrRefReplacer)
    vertexAssignments.push(modelViewMatrixVarAssignment)
  }
  if (usesNormalMatrix) {
    vertexShader = vertexShader.replace(normalMatrixRefRE, attrRefReplacer)
    vertexAssignments.push(normalMatrixVarAssignment)
    // Add the inverse() glsl polyfill if there isn't already one defined
    if (!/\binverse\s*\(/.test(vertexShader)) {
      vertexDeclarations.push(inverseFunction)
    }
  }

  // Add attributes and varyings for, and rewrite references to, instanceUniforms
  instanceUniforms.forEach(name => {
    let vertType = vertexUniforms[name]
    let fragType = fragmentUniforms[name]
    if (vertType || fragType) {
      let finder = new RegExp(`\\b${name}\\b`, 'g')
      vertexDeclarations.push(`attribute ${vertType || fragType} troika_${name};`)
      if (vertType) {
        vertexShader = vertexShader.replace(finder, attrRefReplacer)
      }
      if (fragType) {
        fragmentShader = fragmentShader.replace(finder, varyingRefReplacer)
        let varyingDecl = `varying ${fragType} troika_vary_${name};`
        vertexDeclarations.push(varyingDecl)
        fragmentDeclarations.push(varyingDecl)
        vertexAssignments.push(`troika_vary_${name} = troika_${name};`)
      }
    }
  })

  // Inject vertex shader declarations and assignments
  vertexShader = `
${vertexDeclarations.join('\n')}
${vertexShader.replace(voidMainRegExp, `
  $&
  ${ vertexAssignments.join('\n') }
`)}`

  // Inject fragment shader declarations
  if (fragmentDeclarations.length) {
    fragmentShader = `
${fragmentDeclarations.join('\n')}
${fragmentShader}`
  }

  return {vertexShader, fragmentShader}
}

