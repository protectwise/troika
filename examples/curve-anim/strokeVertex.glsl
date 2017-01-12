// Basic three-line-2d vertex shader for the line stroke

uniform float thickness;
attribute float lineMiter;
attribute vec2 lineNormal;

void main() {
  vec3 pointPos = position.xyz + vec3(lineNormal * thickness / 2.0 * lineMiter, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pointPos, 1.0);
}
