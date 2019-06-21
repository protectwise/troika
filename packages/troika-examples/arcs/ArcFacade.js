import {Mesh, ShaderMaterial, MeshStandardMaterial, BoxBufferGeometry, Color, Sphere, Vector3, DoubleSide} from 'three'
import {Object3DFacade, createDerivedMaterial} from 'troika-3d'
import arcVertexShader from './arcVertexShader.glsl'
import arcFragmentShader from './arcFragmentShader.glsl'

const baseColor = new Color(0x3ba7db)
const highlightColor = new Color(0xffffff)

const baseGeometry = new BoxBufferGeometry(1, 1, 1, 8, 1, 1)

const customShaderMaterial = new ShaderMaterial({
  uniforms: {
    color: { value: baseColor },
    opacity: { value: 1 },
    startAngle: { value: 0 },
    endAngle: { value: Math.PI / 2 },
    startRadius: { value: 1 },
    endRadius: { value: 2 }
  },
  vertexShader: arcVertexShader,
  fragmentShader: arcFragmentShader,
  transparent: true
})


const derivedMaterial = createDerivedMaterial(
  new MeshStandardMaterial({
    transparent: true
  }),
  // baseMaterial1,
  {
    uniforms: {
      startAngle: { value: 0 },
      endAngle: { value: Math.PI / 2 },
      startRadius: { value: 1 },
      endRadius: { value: 2 }
    },
    vertexDefs: `
      uniform float startAngle;
      uniform float endAngle;
      uniform float startRadius;
      uniform float endRadius;
    `,
    vertexTransform: `
      // Translate the position x and y, which are in the range [-0.5, 0.5], to angle and radius
      float angle = endAngle + ((position.x + 0.5) * (startAngle - endAngle));
      float radius = startRadius + ((position.y + 0.5) * (endRadius - startRadius));
    
      // Translate the angle and radius to a new x and y. Yay high school trig!
      position = vec3(
        cos(angle) * radius,
        sin(angle) * radius,
        position.z
      );
      
      // Rotate the normal by the same angle so lighting is correct
      float normalRotZ = angle - PI2;
      normal = normalize(vec3(
        vec4(normal, 1.0) * mat4( cos(normalRotZ), -sin(normalRotZ), 0, 0, sin(normalRotZ), cos(normalRotZ), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 )
      ));
    `
  }
)

const doubleDerivedMaterial = createDerivedMaterial(derivedMaterial, {
  vertexDefs: `
    varying vec2 vXY;
  `,
  vertexTransform: `
    vXY = vec2(position);
  `,
  fragmentDefs: `
    varying vec2 vXY;
  `,
  fragmentColorTransform: `
    gl_FragColor.x *= 6.0 * (vXY.x + .5);
    gl_FragColor.y *= 2.0 * (vXY.y + .5);
    if (length(vXY) < 0.2) {
      discard;
    }
  `
})
doubleDerivedMaterial.side = DoubleSide

const materialLevels = [
  customShaderMaterial,
  derivedMaterial,
  doubleDerivedMaterial
]


const infiniteSphere = new Sphere(new Vector3(), Infinity)


export default class Arc extends Object3DFacade {
  constructor(parent) {
    let mesh = new Mesh(baseGeometry, null)
    super(parent, mesh)
    this.derivedLevel = 0
  }

  set derivedLevel(derivedLevel) {
    if (derivedLevel !== this._derivedLevel) {
      this._derivedLevel = derivedLevel
      this.threeObject.material = (materialLevels[derivedLevel]).clone()
    }
  }

  afterUpdate() {
    const material = this.threeObject.material
    material.wireframe = !!this.wireframe
    let uniforms = material.uniforms
    uniforms.startAngle.value = this.startAngle
    uniforms.endAngle.value = this.endAngle
    uniforms.startRadius.value = this.startRadius
    uniforms.endRadius.value = this.endRadius
    if (this._derivedLevel > 0) {
      material.opacity = this.opacity
      material.color = this.highlight ? highlightColor : baseColor
    } else {
      uniforms.opacity.value = this.opacity
      uniforms.color.value = this.highlight ? highlightColor : baseColor
    }
    super.afterUpdate()
  }

  /**
   * Override getBoundingSphere method to handle vertex shader transformation
   *
   * Notice that for simplicity we just provide an infinite bounding sphere, essentially
   * bypassing the bounding sphere prefilter and triggering full raycast of all arcs.
   * This lets us avoid having to track changes to the angle/radius uniform props, and we
   * can get away with it because the total number of objects in this scene is small enough
   * that we can just raycast all of them without a bounding sphere prefilter. If that weren't
   * the case, you'd need to make this sphere more tightly wrapped to the actual arc, and then
   * in `afterUpdate` you'd need to test whether any of the angle/radius props was changed and
   * if so send a `this.notifyWorld('object3DBoundsChanged')` message so the raycasting
   * octree gets updated.
   */
  getBoundingSphere() {
    return infiniteSphere
  }

  /**
   * Override raycast method to handle vertex shader transformation
   */
  raycast(raycaster) {
    let {startAngle, endAngle, startRadius, endRadius=startRadius, threeObject} = this
    let origGeom = threeObject.geometry
    let raycastGeometry = origGeom.clone()

    // Modify raycasting geometry to match what the vertex shader would produce
    let posAttr = raycastGeometry.attributes.position
    for (let i = 0; i < posAttr.count; i++) {
      let angle = endAngle + ((posAttr.getX(i) + 0.5) * (startAngle - endAngle));
      let radius = startRadius + ((posAttr.getY(i) + 0.5) * (endRadius - startRadius));
      posAttr.setXY(i, Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    raycastGeometry.computeBoundingSphere()

    // Temporarily replace geometry with the modified one
    threeObject.geometry = raycastGeometry
    let result = super.raycast(raycaster)
    threeObject.geometry = origGeom
    return result
  }
}
