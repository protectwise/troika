import { voidMainRegExp } from './voidMainRegExp.js'
import { expandShaderIncludes } from './expandShaderIncludes.js'
import { MeshDepthMaterial, MeshDistanceMaterial, RGBADepthPacking, UniformsUtils } from 'three'


// Local assign polyfill to avoid importing troika-core
const assign = Object.assign || function(/*target, ...sources*/) {
  let target = arguments[0]
  for (let i = 1, len = arguments.length; i < len; i++) {
    let source = arguments[i]
    if (source) {
      for (let prop in source) {
        if (source.hasOwnProperty(prop)) {
          target[prop] = source[prop]
        }
      }
    }
  }
  return target
}


const epoch = Date.now()
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
 * @param {String} options.timeUniform - If specified, a uniform of this name will be injected into
 *        both shaders, and it will automatically be updated on each render frame with a number of
 *        elapsed milliseconds. The "zero" epoch time is not significant so don't rely on this as a
 *        true calendar time.
 * @param {String} options.vertexDefs - Custom GLSL code to inject into the vertex shader's top-level
 *        definitions, above the `void main()` function.
 * @param {String} options.vertexMainIntro - Custom GLSL code to inject at the top of the vertex
 *        shader's `void main` function.
 * @param {String} options.vertexMainOutro - Custom GLSL code to inject at the end of the vertex
 *        shader's `void main` function.
 * @param {String} options.vertexTransform - Custom GLSL code to manipulate the `position`, `normal`,
 *        and/or `uv` vertex attributes. This code will be wrapped within a standalone function with
 *        those attributes exposed by their normal names as read/write values.
 * @param {String} options.fragmentDefs - Custom GLSL code to inject into the fragment shader's top-level
 *        definitions, above the `void main()` function.
 * @param {String} options.fragmentMainIntro - Custom GLSL code to inject at the top of the fragment
 *        shader's `void main` function.
 * @param {String} options.fragmentMainOutro - Custom GLSL code to inject at the end of the fragment
 *        shader's `void main` function. You can manipulate `gl_FragColor` here but keep in mind it goes
 *        after any of ThreeJS's color postprocessing shader chunks (tonemapping, fog, etc.), so if you
 *        want those to apply to your changes use `fragmentColorTransform` instead.
 * @param {String} options.fragmentColorTransform - Custom GLSL code to manipulate the `gl_FragColor`
 *        output value. Will be injected near the end of the `void main` function, but before any
 *        of ThreeJS's color postprocessing shader chunks (tonemapping, fog, etc.), and before the
 *        `fragmentMainOutro`.
 * @param {function<{vertexShader,fragmentShader}>:{vertexShader,fragmentShader}} options.customRewriter - A function
 *        for performing custom rewrites of the full shader code. Useful if you need to do something
 *        special that's not covered by the other builtin options. This function will be executed before
 *        any other transforms are applied.
 *
 * @return {THREE.Material}
 *
 * The returned material will also have two new methods, `getDepthMaterial()` and `getDistanceMaterial()`,
 * which can be called to get a variant of the derived material for use in shadow casting. If the
 * target mesh is expected to cast shadows, then you can assign these to the mesh's `customDepthMaterial`
 * (for directional and spot lights) and/or `customDistanceMaterial` (for point lights) properties to
 * allow the cast shadow to honor your derived shader's vertex transforms and discarded fragments. These
 * will also set a custom `#define IS_DEPTH_MATERIAL` or `#define IS_DISTANCE_MATERIAL` that you can look
 * for in your derived shaders with `#ifdef` to customize their behavior for the depth or distance
 * scenarios, e.g. skipping antialiasing or expensive shader logic.
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

  // Even if baseMaterial is changing, use a consistent id in shader rewrites based on the
  // optionsHash. This makes it more likely that deriving from base materials of the same
  // type/class, e.g. multiple instances of MeshStandardMaterial, will produce identical
  // rewritten shader code so they can share a single WebGLProgram behind the scenes.
  const id = getIdForOptionsHash(optionsHash)
  const privateDerivedShadersProp = `_derivedShaders${id}`
  const privateBeforeCompileProp = `_onBeforeCompile${id}`
  let distanceMaterialTpl, depthMaterialTpl

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

    // Inject auto-updating time uniform if requested
    if (options.timeUniform) {
      shaderInfo.uniforms[options.timeUniform] = {
        get value() {return Date.now() - epoch}
      }
    }

    // Users can still add their own handlers on top of ours
    if (this[privateBeforeCompileProp]) {
      this[privateBeforeCompileProp](shaderInfo)
    }
  }

  function DerivedMaterial() {
    baseMaterial.constructor.apply(this, arguments)
    this._listeners = undefined //don't inherit EventDispatcher listeners
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
          this.extensions = assign({}, source.extensions)
          this.defines = assign({}, source.defines)
          this.uniforms = UniformsUtils.clone(source.uniforms)
        }
        return this
      }
    },

    /**
     * Utility to get a MeshDepthMaterial that will honor this derived material's vertex
     * transformations and discarded fragments.
     */
    getDepthMaterial: {value: function() {
      let depthMaterial = this._depthMaterial
      if (!depthMaterial) {
        if (!depthMaterialTpl) {
          depthMaterialTpl = createDerivedMaterial(
            baseMaterial.isDerivedMaterial
              ? baseMaterial.getDepthMaterial()
              : new MeshDepthMaterial({depthPacking: RGBADepthPacking}),
            options
          )
          depthMaterialTpl.defines.IS_DEPTH_MATERIAL = ''
        }
        depthMaterial = this._depthMaterial = depthMaterialTpl.clone()
        depthMaterial.uniforms = this.uniforms //automatically recieve same uniform values
      }
      return depthMaterial
    }},

    /**
     * Utility to get a MeshDistanceMaterial that will honor this derived material's vertex
     * transformations and discarded fragments.
     */
    getDistanceMaterial: {value: function() {
      let distanceMaterial = this._distanceMaterial
      if (!distanceMaterial) {
        if (!distanceMaterialTpl) {
          distanceMaterialTpl = createDerivedMaterial(
            baseMaterial.isDerivedMaterial
              ? baseMaterial.getDistanceMaterial()
              : new MeshDistanceMaterial(),
            options
          )
          distanceMaterialTpl.defines.IS_DISTANCE_MATERIAL = ''
        }
        distanceMaterial = this._distanceMaterial = distanceMaterialTpl.clone()
        distanceMaterial.uniforms = this.uniforms //automatically recieve same uniform values
      }
      return distanceMaterial
    }},

    dispose: {value() {
      const {_depthMaterial, _distanceMaterial} = this
      if (_depthMaterial) _depthMaterial.dispose()
      if (_distanceMaterial) _distanceMaterial.dispose()
      baseMaterial.dispose.call(this)
    }}
  })

  const material = new DerivedMaterial()
  material.copy(baseMaterial)

  // Merge uniforms, defines, and extensions
  material.uniforms = assign(UniformsUtils.clone(baseMaterial.uniforms || {}), options.uniforms)
  material.defines = assign({}, baseMaterial.defines, options.defines)
  material.defines[`TROIKA_DERIVED_MATERIAL_${id}`] = '' //force a program change from the base material
  material.extensions = assign({}, baseMaterial.extensions, options.extensions)

  cached[optionsHash] = material
  return material.clone() //return a clone so changes made to it don't affect the cached object
}


function upgradeShaders({vertexShader, fragmentShader}, options, id) {
  let {
    vertexDefs,
    vertexMainIntro,
    vertexMainOutro,
    vertexTransform,
    fragmentDefs,
    fragmentMainIntro,
    fragmentMainOutro,
    fragmentColorTransform,
    customRewriter,
    timeUniform
  } = options

  vertexDefs = vertexDefs || ''
  vertexMainIntro = vertexMainIntro || ''
  vertexMainOutro = vertexMainOutro || ''
  fragmentDefs = fragmentDefs || ''
  fragmentMainIntro = fragmentMainIntro || ''
  fragmentMainOutro = fragmentMainOutro || ''

  // Expand includes if needed
  if (vertexTransform || customRewriter) {
    vertexShader = expandShaderIncludes(vertexShader)
  }
  if (fragmentColorTransform || customRewriter) {
    // We need to be able to find postprocessing chunks after include expansion in order to
    // put them after the fragmentColorTransform, so mark them with comments first. Even if
    // this particular derivation doesn't have a fragmentColorTransform, other derivations may,
    // so we still mark them.
    fragmentShader = fragmentShader.replace(
      /^[ \t]*#include <((?:tonemapping|encodings|fog|premultiplied_alpha|dithering)_fragment)>/gm,
      '\n//!BEGIN_POST_CHUNK $1\n$&\n//!END_POST_CHUNK\n'
    )
    fragmentShader = expandShaderIncludes(fragmentShader)
  }

  // Apply custom rewriter function
  if (customRewriter) {
    let res = customRewriter({vertexShader, fragmentShader})
    vertexShader = res.vertexShader
    fragmentShader = res.fragmentShader
  }

  // The fragmentColorTransform needs to go before any postprocessing chunks, so extract
  // those and re-insert them into the outro in the correct place:
  if (fragmentColorTransform) {
    let postChunks = []
    fragmentShader = fragmentShader.replace(
      /^\/\/!BEGIN_POST_CHUNK[^]+?^\/\/!END_POST_CHUNK/gm, // [^]+? = non-greedy match of any chars including newlines
      match => {
        postChunks.push(match)
        return ''
      }
    )
    fragmentMainOutro = `${fragmentColorTransform}\n${postChunks.join('\n')}\n${fragmentMainOutro}`
  }

  // Inject auto-updating time uniform if requested
  if (timeUniform) {
    const code = `\nuniform float ${timeUniform};\n`
    vertexDefs = code + vertexDefs
    fragmentDefs = code + fragmentDefs
  }

  // Inject a function for the vertexTransform and rename all usages of position/normal/uv
  if (vertexTransform) {
    vertexDefs = `${vertexDefs}
vec3 troika_position_${id};
vec3 troika_normal_${id};
vec2 troika_uv_${id};
void troikaVertexTransform${id}(inout vec3 position, inout vec3 normal, inout vec2 uv) {
  ${vertexTransform}
}
`
    vertexMainIntro = `
troika_position_${id} = vec3(position);
troika_normal_${id} = vec3(normal);
troika_uv_${id} = vec2(uv);
troikaVertexTransform${id}(troika_position_${id}, troika_normal_${id}, troika_uv_${id});
${vertexMainIntro}
`
    vertexShader = vertexShader.replace(/\b(position|normal|uv)\b/g, (match, match1, index, fullStr) => {
      return /\battribute\s+vec[23]\s+$/.test(fullStr.substr(0, index)) ? match1 : `troika_${match1}_${id}`
    })
  }

  // Inject defs and intro/outro snippets
  vertexShader = injectIntoShaderCode(vertexShader, id, vertexDefs, vertexMainIntro, vertexMainOutro)
  fragmentShader = injectIntoShaderCode(fragmentShader, id, fragmentDefs, fragmentMainIntro, fragmentMainOutro)

  return {
    vertexShader,
    fragmentShader
  }
}

function injectIntoShaderCode(shaderCode, id, defs, intro, outro) {
  if (intro || outro || defs) {
    shaderCode = shaderCode.replace(voidMainRegExp, `
${defs}
void troikaOrigMain${id}() {`
    )
    shaderCode += `
void main() {
  ${intro}
  troikaOrigMain${id}();
  ${outro}
}`
  }
  return shaderCode
}

function getOptionsHash(options) {
  return JSON.stringify(options, optionsJsonReplacer)
}

function optionsJsonReplacer(key, value) {
  return key === 'uniforms' ? undefined : typeof value === 'function' ? value.toString() : value
}

let _idCtr = 0
const optionsHashesToIds = new Map()
function getIdForOptionsHash(optionsHash) {
  let id = optionsHashesToIds.get(optionsHash)
  if (id == null) {
    optionsHashesToIds.set(optionsHash, (id = ++_idCtr))
  }
  return id
}
