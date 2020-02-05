import {number, color} from '../src/Interpolators.js'

test('number interpolator', () => {
  expect(number(1, 99, 0)).toBe(1)
  expect(number(1, 99, 1)).toBe(99)
  expect(number(1, 99, 0.5)).toBe(50)
  expect(number(-100, 100, 0.25)).toBe(-50)
})


describe('color interpolator', () => {
  test('colors as 24-bit numbers', () => {
    expect(color(0x000000, 0xeeeeee, 0.5)).toBe(0x777777)
    expect(color(0x111111, 0xffffff, 0.5)).toBe(0x888888)
  })

  test('three.js Color objects', () => {
    expect(
      color(
        // Create duck-typed Color objects since threejs isn't a dependency
        {isColor: true, getHex: () => 0x111111},
        {isColor: true, getHex: () => 0xdddddd},
        0.5
      )
    ).toBe(0x777777)
  })

  // TODO: The following tests require a working <canvas> implementation which is
  // not currently present in the test environment.

  test.skip('color keyword strings', () => {
    const result = color('black', 'yellow', 0.5)
    expect(result).toBe(0x7fff80)
  })

  test.skip('hex strings', () => {
    const result = color('#000000', '#ffff00', 0.5)
    expect(result).toBe(0x7fff80)
  })

  test.skip('rgb strings', () => {
    const result = color('rgb(0,0,0)', 'rgb(255,255,0)', 0.5)
    expect(result).toBe(0x7fff80)
  })
})
