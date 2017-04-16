import {ShaderChunk} from 'three'


function hasTroikaUpgrade(chunk) {
  return chunk.indexOf('TROIKA_INSTANCED') > -1
}

// Upgrade first common vertex shader chunk to add support for the instanced matrices
if (!hasTroikaUpgrade(ShaderChunk.uv_pars_vertex)) {
ShaderChunk.uv_pars_vertex += `
#ifdef TROIKA_INSTANCED

// matrix inversion utility - credit https://github.com/stackgl/glsl-inverse
mat3 inverse(mat3 m) {
  float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
  float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
  float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

  float b01 = a22 * a11 - a12 * a21;
  float b11 = -a22 * a10 + a12 * a20;
  float b21 = a21 * a10 - a11 * a20;

  float det = a00 * b01 + a01 * b11 + a02 * b21;

  return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
              b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
              b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;
}

// define attributes for instance matrices
attribute vec4 troikaInstanceModelMatrixRow0;
attribute vec4 troikaInstanceModelMatrixRow1;
attribute vec4 troikaInstanceModelMatrixRow2;

mat4 getTroikaInstanceModelMatrix() {
  return mat4(
    troikaInstanceModelMatrixRow0.x, troikaInstanceModelMatrixRow1.x, troikaInstanceModelMatrixRow2.x, 0.0,
    troikaInstanceModelMatrixRow0.y, troikaInstanceModelMatrixRow1.y, troikaInstanceModelMatrixRow2.y, 0.0,
    troikaInstanceModelMatrixRow0.z, troikaInstanceModelMatrixRow1.z, troikaInstanceModelMatrixRow2.z, 0.0,
    troikaInstanceModelMatrixRow0.w, troikaInstanceModelMatrixRow1.w, troikaInstanceModelMatrixRow2.w, 1.0
  );
}

mat4 getTroikaInstanceModelViewMatrix() {
  return viewMatrix * getTroikaInstanceModelMatrix();
}

#endif
`
}


// Normal matrix gets calculated per vertex in instancing mode, to avoid the
// expensive CPU calculation and an extra 3 attributes
if (!hasTroikaUpgrade(ShaderChunk.defaultnormal_vertex)) {
ShaderChunk.defaultnormal_vertex = `
#ifdef TROIKA_INSTANCED

// from base chunk:
#ifdef FLIP_SIDED
objectNormal = -objectNormal;
#endif

vec3 transformedNormal = transpose(inverse(mat3(getTroikaInstanceModelViewMatrix()))) * objectNormal;

#else
${ShaderChunk.defaultnormal_vertex}
#endif
`
}


// For any other shader chunks that use the modelMatrix and modelViewMatrix uniforms,
// allow them to use the troika instancing matrices instead:
let _modelViewRE = /\bmodelViewMatrix\b/gm
let _modelRE = /\bmodelMatrix\b/gm
Object.keys(ShaderChunk).forEach(name => {
  let chunk = ShaderChunk[name]
  if (!hasTroikaUpgrade(chunk) && (_modelViewRE.test(chunk) || _modelRE.test(chunk))) {
    ShaderChunk[name] = `
#ifdef TROIKA_INSTANCED
${ chunk.replace(_modelViewRE, 'getTroikaInstanceModelViewMatrix()').replace(_modelRE, 'getTroikaInstanceModelMatrix()') }
#else
${ chunk }
#endif
    `
  }
})
