


export function setUpToFourValues(targetVec4, value) {
  if (Array.isArray(value)) {
    const len = value.length
    targetVec4.set(
      value[0] || 0,
      (len > 1 ? value[1] : value[0]) || 0,
      (len > 2 ? value[2] : value[0]) || 0,
      (len > 3 ? value[3] : len > 1 ? value[1] : value[0]) || 0
    )
  } else {
    targetVec4.setScalar(value || 0)
  }
}