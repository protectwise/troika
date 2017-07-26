import {ShaderChunk} from 'three'

const declarations = `
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

// define attributes for instance matrices
attribute vec4 troika_modelMatrixRow0;
attribute vec4 troika_modelMatrixRow1;
attribute vec4 troika_modelMatrixRow2;
`


const modelMatrixVariable = `
mat4 troika_modelMatrix = mat4(
  %0.x, %1.x, %2.x, 0.0,
  %0.y, %1.y, %2.y, 0.0,
  %0.z, %1.z, %2.z, 0.0,
  %0.w, %1.w, %2.w, 1.0
);
`.replace(/%/g, 'troika_modelMatrixRow')

const modelViewMatrixVariable = `
mat4 troika_modelViewMatrix = viewMatrix * troika_modelMatrix;
`

const normalMatrixVariable = `
mat3 troika_normalMatrix = transpose(inverse(mat3(troika_modelViewMatrix)));
`


const voidMainRE = /\bvoid\s+main\s*\(\s*\)\s*{/gm
const modelMatrixRE = /\bmodelMatrix\b/gm
const modelViewMatrixRE = /\bmodelViewMatrix\b/gm
const normalMatrixRE = /\bnormalMatrix\b/gm


// Copied from threejs WebGLProgram so we can pre-expand the shader includes
function parseIncludes( source ) {
  const pattern = /^[ \t]*#include +<([\w\d.]+)>/gm
  function replace(match, include) {
    let chunk = ShaderChunk[include]
    return chunk ? parseIncludes(chunk) : match
  }
  return source.replace( pattern, replace )
}



export function upgradeVertexShader(source) {
  // Pre-expand includes
  source = parseIncludes(source)

  let usesModelMatrix = modelMatrixRE.test(source)
  let usesModelViewMatrix = modelViewMatrixRE.test(source)
  let usesNormalMatrix = normalMatrixRE.test(source)

  // Inject declarations
  source = source.replace(voidMainRE, `
#ifdef TROIKA_INSTANCED
${ declarations }
#endif

$&

#ifdef TROIKA_INSTANCED
${ usesModelMatrix ? modelMatrixVariable : '' }
${ usesModelViewMatrix ? modelViewMatrixVariable : '' }
${ usesNormalMatrix ? normalMatrixVariable : '' }
#endif
`)

  // Translate uniform references to the instance variables
  if (usesModelMatrix) {
    source = source.replace(modelMatrixRE, 'troika_modelMatrix')
  }
  if (usesModelViewMatrix) {
    source = source.replace(modelViewMatrixRE, 'troika_modelViewMatrix')
  }
  if (usesNormalMatrix) {
    source = source.replace(normalMatrixRE, 'troika_normalMatrix')
  }
  
  return source
}

