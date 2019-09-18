function getGeometry (facade) {
  if (facade.instancedThreeObject) {
    return facade.instancedThreeObject.geometry
  } else if (facade.threeObject) {
    return facade.threeObject.geometry
  }
}

export function inferPhysicsShape (facade) {
  const geometry = getGeometry(facade)
  const {
    type,
    parameters
  } = geometry

  switch (type) {
    case 'SphereBufferGeometry':
    case 'SphereGeometry':
      return {
        shape: 'sphere',
        args: [parameters.radius || 1]
      }
    case 'BoxBufferGeometry':
    case 'BoxGeometry':
      return {
        shape: 'box',
        args: [{
          method: 'btVector3',
          args: [
            parameters.width / 2,
            parameters.height / 2,
            parameters.depth / 2
          ]
        }]
      }
    default:
      throw new Error(`Unable to infer physics shape from geometry type:"${type}"`)
  }
}
