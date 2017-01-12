// Basic three-line-2d fragment shader for the line stroke

uniform vec3 color;
uniform float opacity;

void main() {
  gl_FragColor = vec4(color, opacity);
}
