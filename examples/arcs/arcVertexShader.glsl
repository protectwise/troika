uniform float startAngle;
uniform float endAngle;
uniform float startRadius;
uniform float endRadius;


void main()
{
  // Translate the position x and y, which are in the range [-0.5, 0.5], to angle and radius
  float angle = endAngle + ((position.x + 0.5) * (startAngle - endAngle));
  float radius = startRadius + ((position.y + 0.5) * (endRadius - startRadius));

  // Translate the angle and radius to a new x and y. Yay high school trig!
  vec3 newPosition = vec3(
    cos(angle) * radius,
    sin(angle) * radius,
    position.z
  );

  // Project
  gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
}
