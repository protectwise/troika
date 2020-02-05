import Tween from '../src/Tween.js'


describe('callback function', () => {
  test('is stored as the `callback` property', () => {
    const callback = jest.fn()
    const tween = new Tween(callback, 0, 1)
    expect(tween.callback).toBe(callback)
  })

  test('is executed on gotoElapsedTime and gotoEnd', () => {
    const callback = jest.fn()
    const tween = new Tween(callback, 0, 1)

    tween.gotoElapsedTime(0)
    expect(callback).toHaveBeenCalledTimes(1)
    tween.gotoElapsedTime(375)
    expect(callback).toHaveBeenCalledTimes(2)
    tween.gotoEnd()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  test('is called with tweened value', () => {
    const callback = jest.fn()
    const tween = new Tween(callback, 0, 1)

    tween.gotoElapsedTime(0)
    expect(callback).toHaveBeenLastCalledWith(0)
    tween.gotoElapsedTime(375)
    expect(callback).toHaveBeenLastCalledWith(0.5)
    tween.gotoEnd()
    expect(callback).toHaveBeenLastCalledWith(1)
  })

  test('is called with the Tween instance as `this`', () => {
    let thisObj = null
    const callback = function() {
      thisObj = this
    }
    const tween = new Tween(callback, 0, 1)

    tween.gotoElapsedTime(100)
    expect(thisObj).toBe(tween)
  })
})

describe('duration', () => {
  test('is stored as the `duration` property', () => {
    const tween = new Tween(() => {}, 0, 1, 12345)
    expect(tween.duration).toEqual(12345)
  })

  test('sets the `totalElapsed` property', () => {
    const dur = 1583
    const tween = new Tween(() => {}, 0, 1, dur)
    expect(tween.totalElapsed).toEqual(dur)
  })

  test('determines the tween rate', () => {
    const callback = jest.fn()
    const tween = new Tween(callback, 0, 1, 1500)

    tween.gotoElapsedTime(750)
    expect(callback).toHaveBeenLastCalledWith(0.5)
    tween.gotoElapsedTime(1125)
    expect(callback).toHaveBeenLastCalledWith(0.75)
    tween.gotoElapsedTime(1500)
    expect(callback).toHaveBeenLastCalledWith(1)
    tween.gotoEnd()
    expect(callback).toHaveBeenLastCalledWith(1)
    tween.gotoElapsedTime(9999999)
    expect(callback).toHaveBeenLastCalledWith(1)
  })
})

describe('delay', () => {
  test('is stored as the `delay` property', () => {
    const tween = new Tween(() => {}, 0, 1, 1000, 2345)
    expect(tween.delay).toEqual(2345)
  })

  test('adds to the `totalElapsed` property', () => {
    const dur = 1583, delay = 475
    const tween = new Tween(() => {}, 0, 1, dur, delay)
    expect(tween.totalElapsed).toEqual(dur + delay)
  })

  test('time prior to delay should not invoke callback', () => {
    const callback = jest.fn()
    const tween = new Tween(callback, 0, 1, 1000, 500)

    tween.gotoElapsedTime(250)
    expect(callback).toHaveBeenCalledTimes(0)
  })

  test('time after delay should subtract delay from progress', () => {
    const callback = jest.fn()
    const tween = new Tween(callback, 0, 1, 1000, 500)

    tween.gotoElapsedTime(500)
    expect(callback).toHaveBeenLastCalledWith(0)
    tween.gotoElapsedTime(1000)
    expect(callback).toHaveBeenLastCalledWith(0.5)
    tween.gotoElapsedTime(1250)
    expect(callback).toHaveBeenLastCalledWith(0.75)
    tween.gotoEnd()
    expect(callback).toHaveBeenLastCalledWith(1)
  })
})

describe('easing', () => {
  test('is stored as the `easing` property', () => {
    const easingFn = () => {}
    const tween = new Tween(() => {}, 0, 1, 1000, 0, easingFn)
    expect(tween.easing).toBe(easingFn)
  })

  test('builtin easing keywords', () => {
    const callback = jest.fn()
    let tween = new Tween(callback, 0, 1, 1000, 0, 'linear')

    tween.gotoElapsedTime(500)
    expect(callback).toHaveBeenLastCalledWith(.5)

    tween = new Tween(callback, 0, 1, 1000, 0, 'easeOutExpo')
    tween.gotoElapsedTime(500)
    expect(callback).toHaveBeenLastCalledWith(0.96875)

    tween = new Tween(callback, 0, 1, 1000, 0, 'easeInOutBounce')
    tween.gotoElapsedTime(500)
    expect(callback).toHaveBeenLastCalledWith(0.5)
  })

  test('custom easing function', () => {
    const callback = jest.fn()
    const easeCustom = jest.fn(
      progress => Math.round(progress * 10) / 10
    )

    let tween = new Tween(callback, 0, 1, 1000, 0, easeCustom)
    tween.gotoElapsedTime(250)
    expect(easeCustom).toHaveBeenLastCalledWith(.25)
    expect(callback).toHaveBeenLastCalledWith(.3)
    tween.gotoElapsedTime(500)
    expect(easeCustom).toHaveBeenLastCalledWith(.5)
    expect(callback).toHaveBeenLastCalledWith(.5)
    tween.gotoElapsedTime(768)
    expect(easeCustom).toHaveBeenLastCalledWith(.768)
    expect(callback).toHaveBeenLastCalledWith(.8)
  })
})

describe('iterations', () => {
  test('is stored as the `iterations` property', () => {
    const tween = new Tween(() => {}, 0, 1, 1000, 0, 'linear', 250)
    expect(tween.iterations).toEqual(250)
  })

  test('1 by default', () => {
    const callback = jest.fn()
    let tween = new Tween(callback, 0, 1, 1000, 0, 'linear')
    tween.gotoElapsedTime(1500)
    expect(callback).toHaveBeenLastCalledWith(1)
  })

  describe('finite number', () => {
    test('multiplies the `totalElapsed` property', () => {
      const callback = jest.fn()
      let tween = new Tween(callback, 0, 1, 1000, 0, 'linear', 3)
      expect(tween.totalElapsed).toEqual(3000)
      tween = new Tween(callback, 0, 1, 1000, 0, 'linear', 4000)
      expect(tween.totalElapsed).toEqual(4000000)
      tween = new Tween(callback, 0, 1, 5000, 5000, 'linear', 6)
      expect(tween.totalElapsed).toEqual(35000)
    })

    test('iterates that many times', () => {
      const callback = jest.fn()
      let tween = new Tween(callback, 0, 1, 1000, 0, 'linear', 3)
      tween.gotoElapsedTime(500) //first iteration
      expect(callback).toHaveBeenLastCalledWith(0.5)
      tween.gotoElapsedTime(1600) //second
      expect(callback).toHaveBeenLastCalledWith(0.6)
      tween.gotoElapsedTime(2700) //third
      expect(callback).toHaveBeenLastCalledWith(0.7)
      tween.gotoElapsedTime(3200) //anything after last iteration gets final value
      expect(callback).toHaveBeenLastCalledWith(1)
    })
  })

  describe('Infinity', () => {
    test('sets the `totalElapsed` property to a finite number', () => {
      let tween = new Tween(() => {}, 0, 1, 1000, 0, 'linear', Infinity)
      expect(isFinite(tween.totalElapsed)).toBe(true)
    })

    test('iterates forever', () => {
      const callback = jest.fn()
      let tween = new Tween(callback, 0, 1, 1000, 0, 'linear', Infinity)
      tween.gotoElapsedTime(300)
      expect(callback).toHaveBeenLastCalledWith(0.3)
      tween.gotoElapsedTime(1000400)
      expect(callback).toHaveBeenLastCalledWith(0.4)
      tween.gotoElapsedTime(9999999700)
      expect(callback).toHaveBeenLastCalledWith(0.7)
    })
  })
})

describe('direction', () => {
  test('is stored as the `direction` property', () => {
    const tween = new Tween(() => {}, 0, 1, 1000, 0, 'linear', 1, 'alternate')
    expect(tween.direction).toEqual('alternate')
  })

  test('forward by default', () => {
    const callback = jest.fn()
    let tween = new Tween(callback, 0, 1, 1000, 0, 'linear', 1)
    tween.gotoElapsedTime(234)
    expect(callback).toHaveBeenLastCalledWith(0.234)
  })

  test('reverse', () => {
    const callback = jest.fn()
    let tween = new Tween(callback, 0, 1, 1000, 0, 'linear', 1, 'reverse')
    tween.gotoElapsedTime(234)
    expect(callback).toHaveBeenLastCalledWith(0.766)
  })

  test('alternate', () => {
    const callback = jest.fn()
    let tween = new Tween(callback, 0, 1, 1000, 0, 'linear', 4, 'alternate')
    tween.gotoElapsedTime(234)
    expect(callback).toHaveBeenLastCalledWith(0.234)
    tween.gotoElapsedTime(1234)
    expect(callback).toHaveBeenLastCalledWith(0.766)
    tween.gotoElapsedTime(2123)
    expect(callback).toHaveBeenLastCalledWith(0.123)
    tween.gotoElapsedTime(3000)
    expect(callback).toHaveBeenLastCalledWith(1)
    tween.gotoElapsedTime(3123)
    expect(callback).toHaveBeenLastCalledWith(0.877)
    tween.gotoElapsedTime(4123)
    expect(callback).toHaveBeenLastCalledWith(0)
  })
})

describe('interpolate', () => {
  // See Interpolators.test.js for more detailed testing of the individual interpolators

  test('is stored as the `interpolate` property', () => {
    const interpolator = () => {}
    const tween = new Tween(() => {}, 0, 1, 1000, 0, 'linear', 1, 'forward', interpolator)
    expect(tween.interpolate).toBe(interpolator)
  })

  test('number keyword', () => {
    const callback = jest.fn()
    let tween = new Tween(callback, 0, 1, 1000, 0, 'linear', 4, 'forward', 'number')
    tween.gotoElapsedTime(234)
    expect(callback).toHaveBeenLastCalledWith(0.234)
  })

  test('color keyword', () => {
    const callback = jest.fn()
    let tween = new Tween(callback, 0x000000, 0xee6688, 1000, 0, 'linear', 4, 'forward', 'color')
    tween.gotoElapsedTime(500)
    expect(callback).toHaveBeenLastCalledWith(0x773344)
  })

  test('uses number interpolation for unknown keyword', () => {
    const callback = jest.fn()
    let tween = new Tween(callback, 0, 1, 1000, 0, 'linear', 4, 'forward', 'notarealinterpolator')
    tween.gotoElapsedTime(234)
    expect(callback).toHaveBeenLastCalledWith(0.234)
  })

  test('custom interpolator function', () => {
    const callback = jest.fn()
    const interpolator = jest.fn((from, to, progress) => {
      return from.map((v, i) => v + (to[i] - v) * progress)
    })
    let tween = new Tween(callback, [1, 2, 3], [5, 7, 9], 1000, 0, 'linear', 4, 'forward', interpolator)
    tween.gotoElapsedTime(500)
    expect(interpolator).toHaveBeenCalledTimes(1)
    expect(interpolator).toHaveBeenLastCalledWith([1, 2, 3], [5, 7, 9], 0.5)
    expect(callback).toHaveBeenLastCalledWith([3, 4.5, 6])
  })
})
