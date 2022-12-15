import {
  Color,
  Mesh,
  ShaderMaterial,
  DoubleSide,
  Group
} from 'three'
import {Object3DFacade} from 'troika-3d'
import adaptiveBezierCurve from 'adaptive-bezier-curve'
import strokeVertexShader from './strokeVertex.glsl'
import strokeFragmentShader from './strokeFragment.glsl'
import fillVertexShader from './fillVertex.glsl'
import fillFragmentShader from './fillFragment.glsl'
import Line2DGeometry from '../_shared/Line2DGeometry'

// Given an array of y values, construct a smooth curve connecting those points.
function valuesToCurvePoints(values, totalWidth, totalHeight) {
  let p1 = []
  let c1 = []
  let c2 = []
  let p2 = []
  let maxValue = Math.max.apply(Math, values)
  let curveValues = []
  for (let i = 1; i < values.length; i++) {
    let xMult = totalWidth / (values.length - 1)
    let yMult = totalHeight / maxValue
    p1[0] = (i - 1) * xMult
    p1[1] = c1[1] = values[i - 1] * yMult
    c1[0] = c2[0] = (i - .5) * xMult
    c2[1] = p2[1] = values[i] * yMult
    p2[0] = i * xMult
    let segmentPoints = adaptiveBezierCurve(p1, c1, c2, p2)
    for (let j = (i === 1 ? 0 : 1); j < segmentPoints.length; j++) {
      curveValues.push(segmentPoints[j])
    }
  }
  return curveValues
}

// Given an array of y values, construct a step path connecting those points.
function valuesToSquarePoints(values, totalWidth, totalHeight) {
  let maxValue = Math.max.apply(Math, values)
  let curveValues = []
  for (let i = 0; i < values.length; i++) {
    let xMult = totalWidth / (values.length - 1)
    let yMult = totalHeight / maxValue
    if (i > 0) {
      curveValues.push([i * xMult, values[i - 1] * yMult])
    }
    curveValues.push([i * xMult, values[i] * yMult])
  }
  return curveValues
}


// Facade for the curve.
export default class Curve extends Object3DFacade {
  constructor(parent) {
    super(parent, new Group())

    // Use a single Line2D buffer geometry for both stroke and fill meshes
    let geometry = new Line2DGeometry()

    // Stroke mesh with custom shader material
    this.strokeMesh = new Mesh(geometry, new ShaderMaterial({
      uniforms: {
        thickness: {value: 1},
        color: {value: new Color()},
        opacity: {value: 1}
      },
      transparent: true,
      vertexShader: strokeVertexShader,
      fragmentShader: strokeFragmentShader,
      depthTest: false,
      side: DoubleSide
    }))

    // Fill mesh with custom shader material
    this.fillMesh = new Mesh(geometry, new ShaderMaterial({
      uniforms: {
        color: {value: new Color()},
        opacity: {value: 1},
        gradientScale: {value: 1},
        gradientPercent: {value: 1},
        gradientExp: {value: 1},
        maxY: {value: 1}
      },
      transparent: true,
      vertexShader: fillVertexShader,
      fragmentShader: fillFragmentShader,
      depthTest: false,
      side: DoubleSide
    }))
    this.strokeMesh.frustumCulled = this.fillMesh.frustumCulled = false

    // Add both meshes to the Group
    this.threeObject.add(this.strokeMesh, this.fillMesh)
  }

  afterUpdate() {
    // Update the shared geometry
    let geometry = this.strokeMesh.geometry
    geometry.update(
      this.pathShape === 'step' ?
        valuesToSquarePoints(this.values, this.width, this.height) :
        valuesToCurvePoints(this.values, this.width, this.height)
    )

    // Update the stroke mesh
    let hasStroke = this.strokeWidth && this.strokeColor && this.strokeOpacity > 0
    if (hasStroke) {
      let strokeUniforms = this.strokeMesh.material.uniforms
      strokeUniforms.color.value.set(this.strokeColor)
      strokeUniforms.opacity.value = this.strokeOpacity
      strokeUniforms.thickness.value = this.strokeWidth
    }
    this.strokeMesh.visible = !!hasStroke

    // Update the fill mesh
    let hasFill = this.fillColor && this.fillOpacity > 0
    if (hasFill) {
      let fillUniforms = this.fillMesh.material.uniforms
      fillUniforms.color.value.set(this.fillColor)
      fillUniforms.opacity.value = this.fillOpacity
      fillUniforms.gradientScale.value = this.fillGradientScale === 'max-value' ? 1 : 0
      fillUniforms.maxY.value = this.height
      fillUniforms.gradientPercent.value = this.fillGradientPercent || 0
      fillUniforms.gradientExp.value = this.fillGradientExp || 1
    }
    this.fillMesh.visible = !!hasFill

    this.fillMesh.renderOrder = this.strokeMesh.renderOrder = this.renderOrder || 0

    super.afterUpdate()
  }
}

// defaults
Object.assign(Curve.prototype, {
  width: 500,
  height: 100,
  strokeWidth: 2,
  strokeColor: 0xffffff,
  strokeOpacity: 1,
  fillColor: 0xffffff,
  fillOpacity: 0.5,
  fillGradientScale: 'per-value', //or 'max-value'
  fillGradientPercent: 1,
  fillGradientExp: 3,
  pathShape: 'curve' //or 'step'
})
