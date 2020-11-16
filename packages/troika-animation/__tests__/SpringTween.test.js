import SpringTween from '../src/SpringTween.js'

const SPRING_CONFIG = {
  mass: 1,
  tension: 100,
  friction: 50
}

// expected tweened values for 0->1000 at given times, using the above SPRING_CONFIG,
// make sure to use .toBeCloseTo() for matching these
const EXPECTED = {
  '0': 0,
  '100': 153.45462133966558,
  '200': 312.5030977374348,
  '300': 441.8734477476545,
  '400': 546.9009012361223,
  '500': 632.1644501157315,
  '600': 701.3832247912599,
  '700': 757.5765081327479,
  '800': 803.1954187167499,
  '900': 840.229827085882,
  '1000': 870.2951527522193,
  '1100': 894.7028278637895,
  '1200': 914.5175011177348,
  '1300': 930.6034771218361,
  '1400': 943.6624168625153,
  '1500': 954.2639437519764,
  '1600': 962.8704902725829,
  '1700': 969.8574690147684,
  '1800': 975.5296479574913,
  '1900': 980.1344442715282,
  '2000': 983.8727165136212
}

/*
// Generator for EXPECTED values:
const vals = {}
let i = 0
const tween = new SpringTween(v => vals[i] = v, 0, 1000, SPRING_CONFIG)
for (; i <= 2000; i += 100) {
  tween.gotoElapsedTime(i)
}
console.log(vals)
*/

describe('callback function', () => {
  test('is stored as the `callback` property', () => {
    const callback = jest.fn()
    const tween = new SpringTween(callback, 0, 1000, SPRING_CONFIG)
    expect(tween.callback).toBe(callback)
  })

  test('is executed on gotoElapsedTime and gotoEnd', () => {
    const callback = jest.fn()
    const tween = new SpringTween(callback, 0, 1000, SPRING_CONFIG)

    tween.gotoElapsedTime(0)
    expect(callback).toHaveBeenCalledTimes(1)
    tween.gotoElapsedTime(375)
    expect(callback).toHaveBeenCalledTimes(2)
    tween.gotoEnd()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  test('is called with tweened value', () => {
    let latestVal = null
    const callback = v => latestVal = v
    const tween = new SpringTween(callback, 0, 1000, SPRING_CONFIG)
    Object.keys(EXPECTED).forEach(ms => {
      tween.gotoElapsedTime(+ms)
      expect(latestVal).toBeCloseTo(EXPECTED[ms])
    })
    tween.gotoEnd()
    expect(latestVal).toEqual(1000)
  })

  test('is called with the Tween instance as `this`', () => {
    let thisObj = null
    const callback = function() {
      thisObj = this
    }
    const tween = new SpringTween(callback, 0, 1)

    tween.gotoElapsedTime(100)
    expect(thisObj).toBe(tween)
  })
})

describe('delay', () => {
  test('is stored as the `delay` property', () => {
    const tween = new SpringTween(() => {}, 0, 1000, SPRING_CONFIG, 0, 2345)
    expect(tween.delay).toEqual(2345)
  })

  test('time prior to delay should not invoke callback', () => {
    const callback = jest.fn()
    const tween = new SpringTween(() => {}, 0, 1000, SPRING_CONFIG, 0, 500)

    tween.gotoElapsedTime(250)
    expect(callback).toHaveBeenCalledTimes(0)
  })

  test('time after delay should subtract delay from progress', () => {
    const delay = 500
    let latestVal = null
    const callback = v => latestVal = v
    const tween = new SpringTween(callback, 0, 1000, SPRING_CONFIG, 0, delay)

    Object.keys(EXPECTED).forEach(ms => {
      ms = +ms
      tween.gotoElapsedTime(ms)
      if (ms < delay) {
        expect(latestVal).toBeNull()
      } else {
        expect(latestVal).toBeCloseTo(EXPECTED[Math.max(0, +ms - delay)])
      }
    })
    tween.gotoEnd()
    expect(latestVal).toEqual(1000)
  })
})
