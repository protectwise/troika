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
