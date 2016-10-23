uniform vec3 color;
uniform float opacity;

void main() {
  // About as simple as you can get
  gl_FragColor = vec4(color, opacity);
}
