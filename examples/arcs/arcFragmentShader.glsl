uniform vec3 color;
uniform float opacity;

varying float zeeness;

void main() {
  // Very simple lighting math to make sides of the shapes darker
  float darkest = 0.5;
  vec3 shadedColor = color * (darkest + ((1.0 - darkest) * zeeness));
  gl_FragColor = vec4(shadedColor, opacity);
}
