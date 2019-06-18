import { utils } from 'troika-core'
import { voidMainRE, expandShaderIncludes } from './shaderUtils'
import { UniformsUtils } from 'three'
const { assign } = utils

let idCtr = 0



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
  const id = ++idCtr
  const derivedMaterialDepth = (baseMaterial.derivedMaterialDepth || 0) + 1

  // Private onBeforeCompile handler that injects the modified shaders and uniforms when
  // the renderer switches to this material's program
  function onBeforeCompile(shaderInfo) {
    baseMaterial.onBeforeCompile.call(this, shaderInfo)

    // Upgrade the shaders, caching the result
    const {vertex, fragment} = this[`derivedShaders${id}`] || (this[`derivedShaders${id}`] = {vertex: {}, fragment: {}})
    if (vertex.source !== shaderInfo.vertexShader || fragment.source !== shaderInfo.fragmentShader) {
      const upgraded = upgradeShaders(shaderInfo, options)
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
    if (this._userOnBeforeCompile) {
      this._userOnBeforeCompile(shaderInfo)
    }
  }

  function DerivedMaterial() {
    baseMaterial.constructor.apply(this, arguments)
  }
  DerivedMaterial.prototype = assign(
    Object.create(baseMaterial, {
      isDerivedMaterial: {value: true},
      derivedMaterialDepth: {value: derivedMaterialDepth},

      onBeforeCompile: {
        get() {
          return onBeforeCompile
        },
        set(fn) {
          this._userOnBeforeCompile = fn
        }
      }
    }),
    {
      constructor: DerivedMaterial,

      baseMaterial: baseMaterial,

      copy(source) {
        this.baseMaterial.copy.call(this, source)
        if (!this.baseMaterial.isShaderMaterial) {
          this.extensions = source.extensions
          this.defines = assign({}, source.defines)
          this.uniforms = UniformsUtils.clone(source.uniforms)
        }
        return this
      }
    }
  )

  const material = new DerivedMaterial()
  material.copy(baseMaterial)

  // Merge uniforms, defines, and extensions
  material.uniforms = assign(UniformsUtils.clone(baseMaterial.uniforms || {}), options.uniforms)
  material.defines = assign({
    'TROIKA_DERIVED_MATERIAL': derivedMaterialDepth //something to force a program change from the base material
  }, baseMaterial.defines, options.defines)
  material.extensions = assign({}, baseMaterial.extensions, options.extensions)

  return material
}


function upgradeShaders({vertexShader, fragmentShader}, options) {
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
void troikaVertexTransform(inout vec3 position, inout vec3 normal, inout vec2 uv) {
  ${vertexTransform}
}
`
      vertexShader = vertexShader.replace(/\b(position|normal|uv)\b/g, (match, match1, index, fullStr) => {
        return /\battribute\s+vec3\s+$/.test(fullStr.substr(0, index)) ? match1 : 'troika_' + match1
      })
      vertexMainIntro = `
vec3 troika_position = vec3(position);
vec3 troika_normal = vec3(normal);
vec2 troika_uv = vec2(uv);
troikaVertexTransform(troika_position, troika_normal, troika_uv);
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
void troika_orig_main() {
${fragmentMainIntro || ''}
`)
    fragmentShader += `
void main() {
  troika_orig_main();
  ${fragmentColorTransform || ''}
}`
  }

  return {
    vertexShader,
    fragmentShader
  }
}
