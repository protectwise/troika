import { encodeFloatToFourInts, decodeFloatFromFourInts, ShaderFloatArray } from '../src/ShaderFloatArray.js'
import './polyfill/OffscreenCanvas.js'
import { WebGL1Renderer, ShaderMaterial, PlaneGeometry, Mesh, Scene, Camera } from 'three'

const maxFloat32Val = (2 - Math.pow(2, -23)) * Math.pow(2, 127)


describe('encodeFloatToFourInts', () => {
  const testFloat = 0.123456789

  test('Writes four values to an Array', () => {
    const out = []
    encodeFloatToFourInts(testFloat, out, 0)
    expect(out.length).toBe(4)
    for (let i = 0; i < 4; i++) {
      expect(typeof out[i]).toBe('number')
    }
  })

  test('Writes to a Uint8Array the same as an Array', () => {
    const array = new Array(4)
    const typedArray = new Uint8Array(4)
    encodeFloatToFourInts(testFloat, array, 0)
    encodeFloatToFourInts(testFloat, typedArray, 0)
    expect(array).toEqual(Array.from(typedArray))
  })

  test('Writes starting at the startIndex', () => {
    const out = []
    encodeFloatToFourInts(testFloat, out, 1)
    expect(out.length).toBe(5)
    expect(out[0]).toBeUndefined()
    for (let i = 1; i < 5; i++) {
      expect(typeof out[i]).toBe('number')
    }
  })

})

describe('decodeFloatFromFourInts', () => {
  const testInts = [ 31, 122, 198, 80 ]

  test('Reads from an Array', () => {
    const decoded = decodeFloatFromFourInts(testInts, 0)
    expect(typeof decoded).toBe('number')
    expect(decoded <= 1 && decoded >= 0).toBe(true)
  })

  test('Reads from a Uint8Array the same as an Array', () => {
    const decodedFromArray = decodeFloatFromFourInts(testInts, 0)
    const decodedFromTypedArray = decodeFloatFromFourInts(new Uint8Array(testInts), 0)
    expect(decodedFromArray).toEqual(decodedFromTypedArray)
  })

  test('Reads starting at the startIndex', () => {
    const arr1 = [0, 0, 0].concat(testInts)
    const arr2 = [1, 1].concat(testInts)
    expect(decodeFloatFromFourInts(arr1, 3)).toEqual(decodeFloatFromFourInts(arr2, 2))
  })

})

describe('encoding + decoding', () => {
  // Build a repeatable random-ish set of input values
  const values = [0, 1]
  for (let i = 1; i < 10000; i++) {
    values.push(Math.sin(i) * maxFloat32Val)
  }

  test('Precision loss is within limits for decimal values', () => {
    const typedArray = new Uint8Array(4)
    for (let i = 0; i < values.length; i++) {
      encodeFloatToFourInts(values[i], typedArray, 0)
      const decoded = decodeFloatFromFourInts(typedArray, 0)

      // For a given float, determines the maximum precision error in its binary-encoded representation,
      // according to "Precision limitations" on https://en.wikipedia.org/wiki/Single-precision_floating-point_format
      const exp = Math.floor(Math.log2(Math.abs(values[i])))
      const maxDiff = Math.pow(2, exp - 23)

      expect(Math.abs(decoded - values[i])).toBeLessThanOrEqual(maxDiff)
    }
  })

  test('No precision loss for integers between -16777216 and 16777216', () => {
    const typedArray = new Uint8Array(4)
    for (let i = 0; i <= 16777216; i += i + 1) {
      encodeFloatToFourInts(i, typedArray, 0)
      expect(decodeFloatFromFourInts(typedArray, 0)).toBe(i)
      encodeFloatToFourInts(-i, typedArray, 0)
      expect(decodeFloatFromFourInts(typedArray, 0)).toBe(-i)
    }
  })

})


describe('ShaderFloatArray', () => {
  test('', () => {

    let values = []
    // Integers
    for (let i = 0; i < 16777216; i += i + 1) {
      values.push(i)
    }
    for (let sign = -1; sign <= 1; sign += 2) {
      for (let exp = -127; exp <= 128; exp++) {
        values.push(sign * exp * (1 + Math.abs(Math.sin(exp))))
      }
    }
    // Cast all to float32 precision
    values = new Float32Array(values)

    const sfa = new ShaderFloatArray('tester')
    sfa.setArray(values)


    const canvas = new OffscreenCanvas(values.length, 1)

    const renderer = new WebGL1Renderer({ canvas })

    const mesh = new Mesh(
      new PlaneGeometry(),
      new ShaderMaterial({
        uniforms: {
          ...sfa.getShaderUniforms(),
          uExpectedValues: {value: values}
        },
        vertexShader: `
          void main() {
            gl_Position = vec4(position * 2.0, 1.0);
          }
        `,
        fragmentShader: `
          ${sfa.getShaderHeaderCode()}
          
          uniform float uExpectedValues[${values.length}];
          
          void main() {
            // Decode the value from the texture
            float column = floor(gl_FragCoord.x);
            float decodedValue = ${sfa.readFunction}(column);
            
            // Get the expected value from the array - have to get tricky since array access has to be static
            float expectedValue = 0.0;
            ${[...values].map((v, i) => {
              return `if (column == ${i}.0) { expectedValue = uExpectedValues[${i}]; }`
            }).join('\n')}
            
            // Write a 1 or 0 boolean to the red channel indicating whether the decoding matched the expected value
            gl_FragColor = vec4(
              expectedValue == decodedValue ? 1.0 : 0.0,
              1.0, 1.0, 1.0
            );
          }
        `
      })
    )
    const scene = new Scene()
    scene.add(mesh)
    const camera = new Camera();
    renderer.render(scene, camera)

    const pixels = new Uint8Array(canvas.width * canvas.height * 4)
    const gl = renderer.getContext()
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    // All pixels should have 255 in the red channel indicating the float was decoded properly
    for (let i = 0; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255)
    }
  })
})
