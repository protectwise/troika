import { createDerivedMaterial, getShaderUniformTypes, voidMainRegExp } from 'troika-three-utils'

const precededByUniformRE = /\buniform\s+(int|float|vec[234])\s+$/
const attrRefReplacer = (name, index, str) => (precededByUniformRE.test(str.substr(0, index)) ? name : `troika_attr_${name}`)
const varyingRefReplacer = (name, index, str) => (precededByUniformRE.test(str.substr(0, index)) ? name : `troika_vary_${name}`)

export function createInstancedUniformsDerivedMaterial (baseMaterial, uniformNames) {
  const derived = createDerivedMaterial(baseMaterial, {
    defines: {
      TROIKA_INSTANCED_UNIFORMS: uniformNames.sort().join('|')
    },

    customRewriter ({ vertexShader, fragmentShader }) {
      let vertexDeclarations = []
      let vertexAssignments = []
      let fragmentDeclarations = []

      // Find what uniforms are declared in which shader and their types
      let vertexUniforms = getShaderUniformTypes(vertexShader)
      let fragmentUniforms = getShaderUniformTypes(fragmentShader)

      // Add attributes and varyings for, and rewrite references to, the instanced uniforms
      uniformNames.forEach((name) => {
        let vertType = vertexUniforms[name]
        let fragType = fragmentUniforms[name]
        if (vertType || fragType) {
          let finder = new RegExp(`\\b${name}\\b`, 'g')
          vertexDeclarations.push(`attribute ${vertType || fragType} troika_attr_${name};`)
          if (vertType) {
            vertexShader = vertexShader.replace(finder, attrRefReplacer)
          }
          if (fragType) {
            fragmentShader = fragmentShader.replace(finder, varyingRefReplacer)
            let varyingDecl = `varying ${fragType} troika_vary_${name};`
            vertexDeclarations.push(varyingDecl)
            fragmentDeclarations.push(varyingDecl)
            vertexAssignments.push(`troika_vary_${name} = troika_attr_${name};`)
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

  derived.isInstancedUniformsMaterial = true
  return derived
}
