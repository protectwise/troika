import { createDerivedMaterial, getShaderUniformTypes, voidMainRegExp } from 'troika-three-utils'

export function createInstancedUniformsDerivedMaterial(baseMaterial) {
  let _uniforms = new Map()
  let _uniformNamesKey = ''

  const derived = createDerivedMaterial(baseMaterial, {
    chained: true,

    customRewriter ({ vertexShader, fragmentShader }) {
      let vertexDeclarations = []
      let vertexAssignments = []
      let fragmentDeclarations = []

      // Find what uniforms are declared in which shader and their types
      let vertexUniforms = getShaderUniformTypes(vertexShader)
      let fragmentUniforms = getShaderUniformTypes(fragmentShader)

      // Add attributes and varyings for, and rewrite references to, the instanced uniforms
      _uniforms.entries().forEach(([name, options]) => {
        let vertType = vertexUniforms[name]
        let fragType = fragmentUniforms[name]
        const type = vertType || fragType
        if (type) {
          const declarationFinder = new RegExp(`\\buniform\\s+${type}\\s+${name}\\s*;`, 'g')
          const referenceFinder = new RegExp(`\\b${name}\\b`, 'g')
          const attrName = `troika_attr_${name}`
          const varyingName = `troika_vary_${name}`
          vertexDeclarations.push(`attribute ${type} ${attrName};`)
          if (vertType) {
            vertexShader = vertexShader.replace(declarationFinder, '')
            vertexShader = vertexShader.replace(referenceFinder, attrName)
          }
          if (fragType) {
            fragmentShader = fragmentShader.replace(declarationFinder, '')
            fragmentShader = fragmentShader.replace(referenceFinder, varyingName)
            let varyingDecl = `${ (options.interpolate === false) ? 'flat' : '' } varying ${fragType} ${varyingName};`
            vertexDeclarations.push(varyingDecl)
            fragmentDeclarations.push(varyingDecl)
            vertexAssignments.push(`${varyingName} = ${attrName};`)
          }
        }
      })

      // Inject vertex shader declarations and assignments
      vertexShader = `${vertexDeclarations.join('\n')}\n${vertexShader.replace(voidMainRegExp, `\n$&\n${vertexAssignments.join('\n')}`)}`

      // Inject fragment shader declarations
      if (fragmentDeclarations.length) {
        fragmentShader = `${fragmentDeclarations.join('\n')}\n${fragmentShader}`
      }

      return { vertexShader, fragmentShader }
    }
  })

  /**
   * Update the set of uniforms that will be enabled for per-instance values. This
   * can be changed dynamically after instantiation.
   * @param {Map<string, { interpolate: boolean }>} uniforms
   */
  derived.setUniforms = function(uniforms) {
    _uniforms = uniforms || new Map()
    const key = [..._uniforms.keys()].sort().join('|')
    if (key !== _uniformNamesKey) {
      _uniformNamesKey = key
      this.needsUpdate = true
    }
  }

  // Custom program cache key that allows for changing instanced uniforms
  const baseKey = derived.customProgramCacheKey()
  derived.customProgramCacheKey = function() {
    return baseKey + '|' + _uniformNamesKey
  }

  derived.isInstancedUniformsMaterial = true
  return derived
}

