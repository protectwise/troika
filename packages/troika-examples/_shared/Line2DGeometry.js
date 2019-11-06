import { BufferAttribute, BufferGeometry, REVISION } from 'three'
import initLine2DGeometry from 'three-line-2d'


const Line2DGeometry = initLine2DGeometry({BufferAttribute, BufferGeometry})

class PatchedLine2DGeometry extends Line2DGeometry {
  // Patch usage of the deprecated addAttribute method:
  addAttribute(...args) {
    if (this.setAttribute) {
      return this.setAttribute(...args)
    } else {
      return super.setAttribute(...args)
    }
  }

  // Patch overwriting of BufferAttribute.array, which is no longer supported and causes errors:
  update(...args) {
    // Store previous arrays:
    const indexArray = this.getIndex().array
    const attrArrays = {}
    Object.keys(this.attributes).forEach(name => {
      attrArrays[name] = this.getAttribute(name).array
    })

    const result = super.update(...args)

    // If any attribute's array was changed, replace that whole attribute:
    Object.keys(this.attributes).forEach(name => {
      if (attrArrays[name] && attrArrays[name] !== this.getAttribute(name).array) {
        this.setAttribute(name, this.getAttribute(name).clone())
      }
    })
    if (indexArray && indexArray !== this.getIndex().array) {
      this.setIndex(this.getIndex().clone())
    }

    return result
  }
}


export default PatchedLine2DGeometry
