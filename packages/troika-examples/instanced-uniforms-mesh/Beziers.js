import { Object3DFacade } from 'troika-3d'
import { BezierMesh } from 'troika-three-utils'
import { InstancedUniformsMesh } from 'three-instanced-uniforms-mesh'
import { Color, Matrix4, Vector3 } from 'three'

const count = 100
const vec3 = new Vector3()
const mat4 = new Matrix4()
const color = new Color()
const twoPi = Math.PI * 2

export class Beziers extends Object3DFacade {
  constructor (parent) {
    // Create a template BezierMesh and grab its geometry and material
    const { geometry, material } = new BezierMesh()
    material.uniforms.radius.value = 0.01

    // Create InstancedUniformsMesh and init static instance values
    const mesh = new InstancedUniformsMesh(geometry, material, count)
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, mat4.identity()) //must fill matrix array
      const angle = (i / count) * (Math.PI * 2)

      // Outer points will be stationary
      mesh.setUniformAt('pointB', i, vec3ForAngle(angle, 2))

      // Rainbow colors
      mesh.setUniformAt(
        'diffuse',
        i,
        color
          .setRGB(Math.sin(angle + 3), Math.sin(angle + 1), Math.sin(angle * 2))
          .addScalar(0.8)
      )
    }

    super(parent, mesh)

    this.addEventListener('beforerender', () => {
      // Adjust the inner point and control point uniforms in wave patterns
      const angleShift = ((Date.now() % 3000) / 3000) * twoPi
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * (Math.PI * 2)
        mesh.setUniformAt(
          'pointA',
          i,
          vec3ForAngle(angle, 0.3).setZ(Math.sin(angle + angleShift) * 0.2)
        )
        mesh.setUniformAt(
          'controlA',
          i,
          vec3ForAngle(angle, 0.6).setZ(Math.cos(angle * 2 + angleShift) * 0.8)
        )
        mesh.setUniformAt(
          'controlB',
          i,
          vec3ForAngle(angle + Math.cos(angleShift) / 3, 1.7).setZ(
            Math.sin(angle * 3 + angleShift) * 0.8
          )
        )
        // this.mesh.setUniformAt(
        //   'radius',
        //   i,
        //   (Math.sin((angle + angleShift)) + 1.1) * 0.2
        // )
      }
    })
  }
}

function vec3ForAngle (angle, radius) {
  return vec3.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
}

export class App  {
  init () {
    // Create a BezierMesh from which we can grab the geometry and material
    const bezierTemplate = new BezierMesh()
    bezierTemplate.material.uniforms.radius.value = 0.1
    // bezierTemplate.material.roughness = 0.3
    // bezierTemplate.material.metalness = 0.8

    // Create the InstancedUniformsMesh from that BezierMesh template
    const mesh = new InstancedUniformsMesh(
      bezierTemplate.geometry,
      bezierTemplate.material,
      count
    )

    // Set static instance properties
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, mat4.identity()) //must fill matrix array
      const angle = (i / count) * (Math.PI * 2)

      // Outer points will be stationary
      mesh.setUniformAt('pointB', i, vec3ForAngle(angle, 20))

      // Rainbow colors
      mesh.setUniformAt(
        'diffuse',
        i,
        color
          .setRGB(Math.sin(angle + 3), Math.sin(angle + 1), Math.sin(angle * 2))
          .addScalar(0.8)
      )
    }

    const light = new DirectionalLight()
    light.position.set(0, 1, 1)

    this.scene.add(mesh)
    this.scene.add(light)
    this.mesh = mesh
    this.tick()
  }

  update () {
    // Adjust the inner point and control point uniforms in wave patterns
    const angleShift = ((Date.now() % 3000) / 3000) * twoPi
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * (Math.PI * 2)
      this.mesh.setUniformAt(
        'pointA',
        i,
        vec3ForAngle(angle, 3).setZ(Math.sin(angle + angleShift) * 2)
      )
      this.mesh.setUniformAt(
        'controlA',
        i,
        vec3ForAngle(angle, 6).setZ(Math.cos(angle * 2 + angleShift) * 8)
      )
      this.mesh.setUniformAt(
        'controlB',
        i,
        vec3ForAngle(angle + Math.cos(angleShift) / 3, 17).setZ(
          Math.sin(angle * 3 + angleShift) * 8
        )
      )
      // this.mesh.setUniformAt(
      //   'radius',
      //   i,
      //   (Math.sin((angle + angleShift)) + 1.1) * 0.2
      // )
    }

    // Rotate the whole thing slowly
    this.mesh.rotation.x += 0.008
    this.mesh.rotation.y += 0.002
  }
}
