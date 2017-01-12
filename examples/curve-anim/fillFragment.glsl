// Fragment shader for the curve's fill area. Handles both solid color and gradient fill styles.

uniform vec3 color;
uniform float opacity;
uniform float gradientPercent;
uniform float gradientFade;

varying float varCurveHeight;
varying float varY;

void main() {
  float alpha = opacity;

  // If a gradient is defined, calculate the varying opacity for the current y value
  if (gradientPercent > 0.0) {
    float gradPos = smoothstep(varCurveHeight - varCurveHeight * gradientPercent, varCurveHeight, varY);
    alpha = opacity * pow(gradPos, max(gradientFade, 1.0));
  }

  gl_FragColor = vec4(color, alpha);
}
