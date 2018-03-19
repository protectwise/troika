
export function getInheritable(owner, prop) {
  let val
  while (owner && (val = owner[prop]) === 'inherit') {
    owner = owner._flexParent
    val = undefined
  }
  return val
}

