
const UNDEF = undefined

// List of UI flex node properties that should be inherited by default:
export const INHERITABLES = [
  'font',
  'fontSize',
  'textAlign',
  'textIndent',
  'lineHeight',
  'letterSpacing',
  'whiteSpace',
  'overflowWrap',
  'color'
]

export function getInheritable(owner, prop, defaultValue) {
  let val
  while (owner && (val = owner[prop]) === 'inherit') {
    owner = owner.parentFlexNode
    val = UNDEF
  }
  if (val === UNDEF) {
    val = defaultValue
  }
  return val
}

export function getComputedFontSize(owner, defaultFontSize) {
  let val
  while (owner && typeof (val = owner.fontSize) === 'string') {
    if (val === 'inherit') {
      owner = owner.parentFlexNode
      val = UNDEF
    } else if (/%$/.test(val)) {
      const multiplier = parseFloat(val) / 100
      val = getComputedFontSize(owner.parentFlexNode, defaultFontSize)
      if (val !== UNDEF) {
        val *= multiplier
      }
      break
    } else {
      console.warn(`Unknown fontSize: ${val}`)
      val = UNDEF
      break
    }
  }
  if (val === UNDEF) {
    val = defaultFontSize
  }
  return val
}

