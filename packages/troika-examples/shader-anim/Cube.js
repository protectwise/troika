import {ShaderMaterial, Mesh, BoxBufferGeometry, TextureLoader, RepeatWrapping} from 'three'
import {Object3DFacade} from 'troika-3d'


const noiseTexture = new TextureLoader().load('shader-anim/cloud.png')
const lavaTexture = new TextureLoader().load('shader-anim/lava.jpg')
const waterTexture = new TextureLoader().load('shader-anim/water.jpg')
noiseTexture.wrapS = noiseTexture.wrapT = lavaTexture.wrapS = lavaTexture.wrapT = waterTexture.wrapS = waterTexture.wrapT = RepeatWrapping

const vertexShader = `
  varying vec2 vUv;
  void main() 
  { 
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

const fragmentShader = `
  uniform sampler2D baseTexture;
  uniform float baseSpeed;
  uniform sampler2D noiseTexture;
  uniform float noiseScale;
  uniform float alpha;
  uniform float time;
  
  varying vec2 vUv;
  void main() 
  {
    vec2 uvTimeShift = vUv + vec2( -0.7, 1.5 ) * time * baseSpeed;
    vec4 noiseGeneratorTimeShift = texture2D( noiseTexture, uvTimeShift );
    vec2 uvNoiseTimeShift = vUv + noiseScale * vec2( noiseGeneratorTimeShift.r, noiseGeneratorTimeShift.b );
    vec4 baseColor = texture2D( baseTexture, uvNoiseTimeShift );
  
    baseColor.a = alpha;
    gl_FragColor = baseColor;
  }
`

const lavaUniforms = {
  baseTexture: { type: "t", value: lavaTexture },
  baseSpeed: { type: "f", value: 0.05 },
  noiseTexture: { type: "t", value: noiseTexture },
  noiseScale:{ type: "f", value: 0.5337 },
  alpha: { type: "f", value: 1.0 },
  time: { type: "f", value: 1.0 }
}
const waterUniforms = {
  baseTexture: { type: "t", value: waterTexture },
  baseSpeed: { type: "f", value: 1.15 },
  noiseTexture: { type: "t", value: noiseTexture },
  noiseScale:{ type: "f", value: 0.2 },
  alpha: { type: "f", value: 0.8 },
  time: { type: "f", value: 1.0 }
}



class Cube extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(
      new BoxBufferGeometry(100, 100, 100),
      new ShaderMaterial({
        uniforms: lavaUniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
      })
    ))
  }

  set time(time) {
    this.threeObject.material.uniforms.time.value = time
  }
  get time() {
    return this.threeObject.material.uniforms.time.value
  }
}


export class LavaCube extends Cube {
  constructor(parent) {
    super(parent)
    this.threeObject.material.uniforms = lavaUniforms
  }
}


export class WaterCube extends Cube {
  constructor(parent) {
    super(parent)
    this.threeObject.material.uniforms = waterUniforms
  }
}

