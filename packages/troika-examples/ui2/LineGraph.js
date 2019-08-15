import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  DoubleSide,
  Group
} from "three";
import { Object3DFacade } from "troika-3d";
import adaptiveBezierCurve from "adaptive-bezier-curve";
import initLine2DGeometry from "three-line-2d";

const strokeVertexShader = `
// Basic three-line-2d vertex shader for the line stroke

uniform float thickness;
attribute float lineMiter;
attribute vec2 lineNormal;

void main() {
  vec3 pointPos = position.xyz + vec3(lineNormal * thickness / 2.0 * lineMiter, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pointPos, 1.0);
}
`;

const strokeFragmentShader = `
// Basic three-line-2d fragment shader for the line stroke

uniform vec3 color;
uniform float opacity;

void main() {
  gl_FragColor = vec4(color, opacity);
}
`;

const fillVertexShader = `
// Vertex shader for the three-line-2d geometry that drops its down-facing vertices
// to the bottom line, thereby creating a mesh covering the curve's fill area

uniform int gradientScale; //0 = per value, 1 = max value
uniform float maxY;

attribute float lineMiter;

varying float varGradientTopY;
varying float varY;

void main() {
  // Drop all vertexes forming the bottom of triangles down to y:0
  float y = lineMiter < 0.0 ? 0.0 : position.y;

  // Pass along values for gradient distance calculation
  varGradientTopY = gradientScale == 1 ? maxY : position.y;
  varY = y;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, y, 0.0, 1.0);
}
`;

const fillFragmentShader = `
// Fragment shader for the curve's fill area. Handles both solid color and gradient fill styles.

uniform vec3 color;
uniform float opacity;
uniform float gradientPercent;
uniform float gradientExp;

varying float varGradientTopY;
varying float varY;

void main() {
  float alpha = opacity;

  // If a gradient is defined, calculate the varying opacity for the current y value
  if (gradientPercent > 0.0) {
    float gradPos = smoothstep(varGradientTopY - varGradientTopY * gradientPercent, varGradientTopY, varY);
    alpha = opacity * pow(gradPos, max(gradientExp, 1.0));
  }

  gl_FragColor = vec4(color, alpha);
}
`;

const Line2DGeometry = initLine2DGeometry({ BufferAttribute, BufferGeometry });

// Given an array of y values, construct a smooth curve connecting those points.
function valuesToCurvePoints(values, totalWidth, totalHeight) {
  let p1 = [];
  let c1 = [];
  let c2 = [];
  let p2 = [];
  let maxValue = Math.max.apply(Math, values);
  let curveValues = [];
  for (let i = 1; i < values.length; i++) {
    let xMult = totalWidth / (values.length - 1);
    let yMult = totalHeight / maxValue;
    p1[0] = (i - 1) * xMult;
    p1[1] = c1[1] = values[i - 1] * yMult;
    c1[0] = c2[0] = (i - 0.5) * xMult;
    c2[1] = p2[1] = values[i] * yMult;
    p2[0] = i * xMult;
    let segmentPoints = adaptiveBezierCurve(p1, c1, c2, p2);
    for (let j = i === 1 ? 0 : 1; j < segmentPoints.length; j++) {
      curveValues.push(segmentPoints[j]);
    }
  }
  return curveValues;
}

// Given an array of y values, construct a step path connecting those points.
function valuesToSquarePoints(values, totalWidth, totalHeight) {
  let maxValue = Math.max.apply(Math, values);
  let curveValues = [];
  for (let i = 0; i < values.length; i++) {
    let xMult = totalWidth / (values.length - 1);
    let yMult = totalHeight / maxValue;
    if (i > 0) {
      curveValues.push([i * xMult, values[i - 1] * yMult]);
    }
    curveValues.push([i * xMult, values[i] * yMult]);
  }
  return curveValues;
}

// Facade for the curve.
export default class LineGraph extends Object3DFacade {
  constructor(parent) {
    super(parent, new Group());

    // Use a single Line2D buffer geometry for both stroke and fill meshes
    let geometry = new Line2DGeometry();

    // Stroke mesh with custom shader material
    this.strokeMesh = new Mesh(
      geometry,
      new ShaderMaterial({
        uniforms: {
          thickness: { value: 1 },
          color: { value: new Color() },
          opacity: { value: 1 }
        },
        transparent: true,
        vertexShader: strokeVertexShader,
        fragmentShader: strokeFragmentShader,
        //depthTest: false,
        side: DoubleSide
      })
    );

    // Fill mesh with custom shader material
    this.fillMesh = new Mesh(
      geometry,
      new ShaderMaterial({
        uniforms: {
          color: { value: new Color() },
          opacity: { value: 1 },
          gradientScale: { value: 1 },
          gradientPercent: { value: 1 },
          gradientExp: { value: 1 },
          maxY: { value: 1 }
        },
        transparent: true,
        vertexShader: fillVertexShader,
        fragmentShader: fillFragmentShader,
        //depthTest: false,
        side: DoubleSide
      })
    );
    this.strokeMesh.frustumCulled = this.fillMesh.frustumCulled = false;

    // Add both meshes to the Group
    this.threeObject.add(this.strokeMesh, this.fillMesh);
  }

  afterUpdate() {
    // Update the shared geometry
    let geometry = this.strokeMesh.geometry;
    geometry.update(
      this.pathShape === "step"
        ? valuesToSquarePoints(this.values, this.width, this.height)
        : valuesToCurvePoints(this.values, this.width, this.height)
    );

    // Update the stroke mesh
    let hasStroke =
      this.strokeWidth && this.strokeColor && this.strokeOpacity > 0;
    if (hasStroke) {
      let strokeUniforms = this.strokeMesh.material.uniforms;
      strokeUniforms.color.value.set(this.strokeColor);
      strokeUniforms.opacity.value = this.strokeOpacity;
      strokeUniforms.thickness.value = this.strokeWidth;
    }
    this.strokeMesh.visible = !!hasStroke;

    // Update the fill mesh
    let hasFill = this.fillColor && this.fillOpacity > 0;
    if (hasFill) {
      let fillUniforms = this.fillMesh.material.uniforms;
      fillUniforms.color.value.set(this.fillColor);
      fillUniforms.opacity.value = this.fillOpacity;
      fillUniforms.gradientScale.value =
        this.fillGradientScale === "max-value" ? 1 : 0;
      fillUniforms.maxY.value = this.height;
      fillUniforms.gradientPercent.value = this.fillGradientPercent || 0;
      fillUniforms.gradientExp.value = this.fillGradientExp || 1;
    }
    this.fillMesh.visible = !!hasFill;

    this.fillMesh.renderOrder = this.strokeMesh.renderOrder =
      this.renderOrder || 0;

    super.afterUpdate();
  }
}

// defaults
Object.assign(LineGraph.prototype, {
  width: 500,
  height: 100,
  strokeWidth: 2,
  strokeColor: 0xffffff,
  strokeOpacity: 1,
  fillColor: 0xffffff,
  fillOpacity: 0.5,
  fillGradientScale: "per-value", //or 'max-value'
  fillGradientPercent: 1,
  fillGradientExp: 3,
  pathShape: "curve" //or 'step'
});
