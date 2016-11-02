import {ShaderMaterial, Mesh, SphereGeometry, TextureLoader, RepeatWrapping} from 'three'
import {Object3D} from '../../src/index'


const vertexShader = `
  uniform sampler2D noiseTexture;
  uniform float noiseScale;
  
  uniform sampler2D bumpTexture;
  uniform float bumpSpeed;
  uniform float bumpScale;
  
  uniform float time;
  
  varying vec2 vUv;
  
  void main() 
  { 
    vUv = uv;
    
    vec2 uvTimeShift = vUv + vec2( 1.1, 1.9 ) * time * bumpSpeed;
    vec4 noiseGeneratorTimeShift = texture2D( noiseTexture, uvTimeShift );
    vec2 uvNoiseTimeShift = vUv + noiseScale * vec2( noiseGeneratorTimeShift.r, noiseGeneratorTimeShift.g );
    // below, using uvTimeShift seems to result in more of a "rippling" effect
    //   while uvNoiseTimeShift seems to result in more of a "shivering" effect
    vec4 bumpData = texture2D( bumpTexture, uvTimeShift );
  
    // move the position along the normal
    //  but displace the vertices at the poles by the same amount
    float displacement = ( vUv.y > 0.999 || vUv.y < 0.001 ) ? 
      bumpScale * (0.3 + 0.02 * sin(time)) :  
      bumpScale * bumpData.r;
      vec3 newPosition = position + normal * displacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
  }
`

const fragmentShader = `
  uniform sampler2D baseTexture;
  uniform float baseSpeed;
  uniform float repeatS;
  uniform float repeatT;
  
  uniform sampler2D noiseTexture;
  uniform float noiseScale;
  
  uniform sampler2D blendTexture;
  uniform float blendSpeed;
  uniform float blendOffset;
  
  uniform float time;
  uniform float alpha;
  
  varying vec2 vUv;
  
  void main() 
  {
    vec2 uvTimeShift = vUv + vec2( -0.7, 1.5 ) * time * baseSpeed;
    vec4 noiseGeneratorTimeShift = texture2D( noiseTexture, uvTimeShift );
    vec2 uvNoiseTimeShift = vUv + noiseScale * vec2( noiseGeneratorTimeShift.r, noiseGeneratorTimeShift.b );
    vec4 baseColor = texture2D( baseTexture, uvNoiseTimeShift * vec2(repeatS, repeatT) );
  
    vec2 uvTimeShift2 = vUv + vec2( 1.3, -1.7 ) * time * blendSpeed;
    vec4 noiseGeneratorTimeShift2 = texture2D( noiseTexture, uvTimeShift2 );
    vec2 uvNoiseTimeShift2 = vUv + noiseScale * vec2( noiseGeneratorTimeShift2.g, noiseGeneratorTimeShift2.b );
    vec4 blendColor = texture2D( blendTexture, uvNoiseTimeShift2 * vec2(repeatS, repeatT) ) - blendOffset * vec4(1.0, 1.0, 1.0, 1.0);
  
    vec4 theColor = baseColor + blendColor;
    theColor.a = alpha;
    gl_FragColor = theColor;
  }  
`


// base image texture for mesh
var lavaTexture = new TextureLoader().load( 'shader-anim/lava.jpg' );
lavaTexture.wrapS = lavaTexture.wrapT = RepeatWrapping;
// multiplier for distortion speed 
var baseSpeed = 0.02;
// number of times to repeat texture in each direction
var repeatS = 4.0;
var repeatT = 4.0;

// texture used to generate "randomness", distort all other textures
var noiseTexture = new TextureLoader().load( 'shader-anim/cloud.png' );
noiseTexture.wrapS = noiseTexture.wrapT = RepeatWrapping;
// magnitude of noise effect
var noiseScale = 0.5;

// texture to additively blend with base image texture
var blendTexture = lavaTexture;
// multiplier for distortion speed 
var blendSpeed = 0.01;
// adjust lightness/darkness of blended texture
var blendOffset = 0.25;

// texture to determine normal displacement
var bumpTexture = noiseTexture;
// multiplier for distortion speed 
var bumpSpeed   = 0.15;
// magnitude of normal displacement
var bumpScale   = 40.0;


export class Fireball extends Object3D {
  constructor(parent) {
    super(parent, new Mesh(
      new SphereGeometry( 60, 64, 64 ),
      new ShaderMaterial({
        uniforms: {
          baseTexture: { type: "t", value: lavaTexture },
          baseSpeed: { type: "f", value: baseSpeed },
          repeatS: { type: "f", value: repeatS },
          repeatT: { type: "f", value: repeatT },
          noiseTexture: { type: "t", value: noiseTexture },
          noiseScale: { type: "f", value: noiseScale },
          blendTexture: { type: "t", value: blendTexture },
          blendSpeed: { type: "f", value: blendSpeed },
          blendOffset: { type: "f", value: blendOffset },
          bumpTexture: { type: "t", value: bumpTexture },
          bumpSpeed: { type: "f", value: bumpSpeed },
          bumpScale: { type: "f", value: bumpScale },
          alpha: { type: "f", value: 1.0 },
          time: { type: "f", value: 1.0 }
        },
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
