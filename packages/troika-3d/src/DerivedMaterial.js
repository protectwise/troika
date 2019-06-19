import { utils } from 'troika-core'
import { voidMainRE, expandShaderIncludes } from './shaderUtils'
import { UniformsUtils } from 'three'
const { assign } = utils

let idCtr = 0
const CACHE = new WeakMap() //threejs requires WeakMap internally so should be safe to assume support


/**
 * A utility for creating a custom shader material derived from another material's
 * shaders. This allows you to inject custom shader logic and transforms into the
 * builtin ThreeJS materials without having to recreate them from scratch.
 *
 * @param {THREE.Material} baseMaterial - the original material to derive from
 *
 * @param {Object} options - How the base material should be modified.
 * @param {Object} options.defines - Custom `defines` for the material
 * @param {Object} options.extensions - Custom `extensions` for the material, e.g. `{derivatives: true}`
 * @param {Object} options.uniforms - Custom `uniforms` for use in the modified shader. These can
 *        be accessed and manipulated via the resulting material's `uniforms` property, just like
 *        in a ShaderMaterial. You do not need to repeat the base material's own uniforms here.
 * @param {String} options.vertexDefs - Custom GLSL code to inject into the vertex shader's top-level
 *        definitions, above the `void main()` function.
 * @param {String} options.vertexMainIntro - Custom GLSL code to inject at the top of the vertex
 *        shader's `void main` function.
 * @param {String} options.vertexTransform - Custom GLSL code to manipulate the `position`, `normal`,
 *        and/or `uv` vertex attributes. This code will be wrapped within a standalone function with
 *        those attributes exposed by their normal names as read/write values.
 * @param {String} options.fragmentDefs - Custom GLSL code to inject into the fragment shader's top-level
 *        definitions, above the `void main()` function.
 * @param {String} options.fragmentMainIntro - Custom GLSL code to inject at the top of the fragment
 *        shader's `void main` function.
 * @param {String} options.fragmentColorTransform - Custom GLSL code to manipulate the `gl_FragColor`
 *        output value. Will be injected after all other `void main` logic has executed.
 *        TODO allow injecting before base shader logic or elsewhere?
 *
 * @return {THREE.Material}
 */
export function createDerivedMaterial(baseMaterial, options) {
  // First check the cache to see if we've already derived from this baseMaterial using
  // this unique set of options, and if so just return a clone instead of a new subclass
  // which is faster and allows their shader program to be shared when rendering.
  const optionsHash = getOptionsHash(options)
  let cached = CACHE.get(baseMaterial)
  if (!cached) {
    cached = Object.create(null)
    CACHE.set(baseMaterial, cached)
  }
  if (cached[optionsHash]) {
    return cached[optionsHash].clone()
  }

  const id = ++idCtr
  const privateDerivedShadersProp = `_derivedShaders${id}`
  const privateBeforeCompileProp = `_onBeforeCompile${id}`

  // Private onBeforeCompile handler that injects the modified shaders and uniforms when
  // the renderer switches to this material's program
  function onBeforeCompile(shaderInfo) {
    baseMaterial.onBeforeCompile.call(this, shaderInfo)

    // Upgrade the shaders, caching the result
    const {vertex, fragment} = this[privateDerivedShadersProp] || (this[privateDerivedShadersProp] = {vertex: {}, fragment: {}})
    if (vertex.source !== shaderInfo.vertexShader || fragment.source !== shaderInfo.fragmentShader) {
      const upgraded = upgradeShaders(shaderInfo, options, id)
      vertex.source = shaderInfo.vertexShader
      vertex.result = upgraded.vertexShader
      fragment.source = shaderInfo.fragmentShader
      fragment.result = upgraded.fragmentShader
    }

    // Inject upgraded shaders and uniforms into the program
    shaderInfo.vertexShader = vertex.result
    shaderInfo.fragmentShader = fragment.result
    assign(shaderInfo.uniforms, this.uniforms)

    // Users can still add their own handlers on top of ours
    if (this[privateBeforeCompileProp]) {
      this[privateBeforeCompileProp](shaderInfo)
    }
  }

  function DerivedMaterial() {
    baseMaterial.constructor.apply(this, arguments)
  }
  DerivedMaterial.prototype = Object.create(baseMaterial, {
    constructor: {value: DerivedMaterial},
    isDerivedMaterial: {value: true},
    baseMaterial: {value: baseMaterial},

    onBeforeCompile: {
      get() {
        return onBeforeCompile
      },
      set(fn) {
        this[privateBeforeCompileProp] = fn
      }
    },

    copy: {
      value: function (source) {
        baseMaterial.copy.call(this, source)
        if (!baseMaterial.isShaderMaterial && !baseMaterial.isDerivedMaterial) {
          this.extensions = source.extensions
          this.defines = assign({}, source.defines)
          this.uniforms = UniformsUtils.clone(source.uniforms)
        }
        return this
      }
    }
  })

  const material = new DerivedMaterial()
  material.copy(baseMaterial)

  // Merge uniforms, defines, and extensions
  material.uniforms = assign(UniformsUtils.clone(baseMaterial.uniforms || {}), options.uniforms)
  material.defines = assign({}, baseMaterial.defines, options.defines)
  material.defines.TROIKA_DERIVED_MATERIAL = id //force a program change from the base material
  material.extensions = assign({}, baseMaterial.extensions, options.extensions)

  cached[optionsHash] = material
  return material
}


function upgradeShaders({vertexShader, fragmentShader}, options, id) {
  let {
    vertexDefs,
    vertexMainIntro,
    vertexTransform,
    fragmentDefs,
    fragmentMainIntro,
    fragmentColorTransform
  } = options

  // Modify vertex shader
  if (vertexDefs || vertexMainIntro || vertexTransform) {
    // If there's a position transform, we need to:
    // - expand all include statements
    // - replace all usages of the `position` attribute with a mutable variable
    // - inject the transform code into a function and call it to transform the position
    if (vertexTransform) {
      vertexShader = expandShaderIncludes(vertexShader)
      vertexDefs = `${vertexDefs || ''}
void troikaVertexTransform${id}(inout vec3 position, inout vec3 normal, inout vec2 uv) {
  ${vertexTransform}
}
`
      vertexShader = vertexShader.replace(/\b(position|normal|uv)\b/g, (match, match1, index, fullStr) => {
        return /\battribute\s+vec3\s+$/.test(fullStr.substr(0, index)) ? match1 : `troika_${match1}_${id}`
      })
      vertexMainIntro = `
vec3 troika_position_${id} = vec3(position);
vec3 troika_normal_${id} = vec3(normal);
vec2 troika_uv_${id} = vec2(uv);
troikaVertexTransform${id}(troika_position_${id}, troika_normal_${id}, troika_uv_${id});
${vertexMainIntro || ''}
`
    }

    vertexShader = vertexShader.replace(
      voidMainRE,
      `${vertexDefs || ''}\n\n$&\n\n${vertexMainIntro || ''}`)
  }

  // Modify fragment shader
  if (fragmentDefs || fragmentMainIntro || fragmentColorTransform) {
    fragmentShader = expandShaderIncludes(fragmentShader)
    fragmentShader = fragmentShader.replace(voidMainRE, `
${fragmentDefs || ''}
void troikaOrigMain${id}() {
${fragmentMainIntro || ''}
`)
    fragmentShader += `
void main() {
  troikaOrigMain${id}();
  ${fragmentColorTransform || ''}
}`
  }

  return {
    vertexShader,
    fragmentShader
  }
}


function getOptionsHash(options) {
  return JSON.stringify(options, optionsJsonReplacer)
}
function optionsJsonReplacer(key, value) {
  return key === 'uniforms' ? undefined : value
}
