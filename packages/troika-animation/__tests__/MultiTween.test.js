import MultiTween from '../src/MultiTween.js'
import Tween from '../src/Tween.js'


describe('child tweens', () => {
  test('each have their callbacks invoked', () => {
    const tween1 = new Tween(jest.fn(), 0, 1, 1000)
    const tween2 = new Tween(jest.fn(), 0, 1, 1000)
    const multi = new MultiTween([tween1, tween2])
    multi.gotoElapsedTime(500)
    expect(tween1.callback).toHaveBeenCalledTimes(1)
    expect(tween2.callback).toHaveBeenCalledTimes(1)
    expect(tween1.callback).toHaveBeenLastCalledWith(.5)
    expect(tween2.callback).toHaveBeenLastCalledWith(.5)
  })

  test('are not invoked during their individual delay periods', () => {
    const tween1 = new Tween(jest.fn(), 0, 1, 1000, 400)
    const tween2 = new Tween(jest.fn(), 0, 1, 1000, 200)
    const multi = new MultiTween([tween1, tween2])
    multi.gotoElapsedTime(100)
    expect(tween1.callback).not.toHaveBeenCalled()
    expect(tween2.callback).not.toHaveBeenCalled()
    multi.gotoElapsedTime(300)
    expect(tween1.callback).not.toHaveBeenCalled()
    expect(tween2.callback).toHaveBeenCalledTimes(1)
    expect(tween2.callback).toHaveBeenLastCalledWith(.1)
    multi.gotoElapsedTime(500)
    expect(tween1.callback).toHaveBeenCalledTimes(1)
    expect(tween1.callback).toHaveBeenLastCalledWith(.1)
    expect(tween2.callback).toHaveBeenCalledTimes(2)
    expect(tween2.callback).toHaveBeenLastCalledWith(.3)
  })

  test('are invoked with final value after their total length', () => {
    const tween1 = new Tween(jest.fn(), 0, 10, 1000)
    const tween2 = new Tween(jest.fn(), 0, 100, 500, 200)
    const multi = new MultiTween([tween1, tween2])
    multi.gotoElapsedTime(2000)
    expect(tween1.callback).toHaveBeenLastCalledWith(10)
    expect(tween2.callback).toHaveBeenLastCalledWith(100)
  })

  test('are invoked in order of their individual total length', () => {
    const callOrder = []
    const tween1 = new Tween(() => {callOrder.push(1)}, 0, 1, 20000) //20s
    const tween2 = new Tween(() => {callOrder.push(2)}, 0, 1, 5000, 0, 'linear', 3) //15s
    const tween3 = new Tween(() => {callOrder.push(3)}, 0, 1, 1000, 30000) //31s
    const tween4 = new Tween(() => {callOrder.push(4)}, 0, 1, 500, 0, 'linear', Infinity) //unending
    const tween5 = new Tween(() => {callOrder.push(5)}, 0, 1, 500, 500) //1s
    const multi = new MultiTween([tween1, tween2, tween3, tween4, tween5])
    multi.gotoElapsedTime(100000)
    expect(callOrder).toEqual([5, 2, 1, 3, 4])
  })
})

describe('duration', () => {
  test('defaults to the longest totalElapsed of its child tweens', () => {
    const tween1 = new Tween(() => {}, 0, 1, 20000) //20s
    const tween2 = new Tween(() => {}, 0, 1, 5000, 0, 'linear', 3) //15s
    const tween3 = new Tween(() => {}, 0, 1, 1000, 30000) //31s
    const multi = new MultiTween([tween1, tween2, tween3])
    expect(multi.duration).toEqual(31000)
  })

  test('can be set to a specific number', () => {
    const tween1 = new Tween(() => {}, 0, 1, 20000) //20s
    const tween2 = new Tween(() => {}, 0, 1, 5000, 0, 'linear', 3) //15s
    const tween3 = new Tween(() => {}, 0, 1, 1000, 30000) //31s
    const multi = new MultiTween([tween1, tween2, tween3], 123456)
    expect(multi.duration).toEqual(123456)
  })
})

describe('easing', () => {
  test('is applied to all tweens across the full duration', () => {
    const tween1 = new Tween(jest.fn(), 0, 1, 1000, 1000)
    const tween2 = new Tween(jest.fn(), 0, 1, 2000)
    const multi = new MultiTween([tween1, tween2], undefined, 0, 'easeOutQuad')
    multi.gotoElapsedTime(1000)
    expect(tween1.callback).toHaveBeenLastCalledWith(0.5)
    expect(tween2.callback).toHaveBeenLastCalledWith(0.75)
  })

  test('is calculated across a custom duration if supplied', () => {
    const tween1 = new Tween(jest.fn(), 0, 1, 1000, 1000)
    const tween2 = new Tween(jest.fn(), 0, 1, 2000)
    const multi = new MultiTween([tween1, tween2], 4000, 0, 'easeOutQuad')
    multi.gotoElapsedTime(1000)
    expect(tween1.callback).toHaveBeenLastCalledWith(0.75)
    expect(tween2.callback).toHaveBeenLastCalledWith(0.875)
  })
})

describe('delay', () => {
  test('delays the start of all child tweens', () => {
    const tween1 = new Tween(jest.fn(), 0, 10, 2000)
    const tween2 = new Tween(jest.fn(), 10, 20, 1000, 1000)
    const multi = new MultiTween([tween1, tween2], undefined, 5000)
    multi.gotoElapsedTime(2000)
    expect(tween1.callback).not.toHaveBeenCalled()
    expect(tween2.callback).not.toHaveBeenCalled()
    multi.gotoElapsedTime(5500)
    expect(tween1.callback).toHaveBeenLastCalledWith(2.5)
    expect(tween2.callback).not.toHaveBeenCalled()
    multi.gotoElapsedTime(6500)
    expect(tween1.callback).toHaveBeenLastCalledWith(7.5)
    expect(tween2.callback).toHaveBeenLastCalledWith(15)
  })
})

describe('iterations', () => {
  test('loops all child tweens at the total duration', () => {
    const tween1 = new Tween(jest.fn(), 0, 10, 1000)
    const tween2 = new Tween(jest.fn(), 10, 20, 2000)
    const multi = new MultiTween([tween1, tween2], undefined, 0, 'linear', 4)
    function testTime(time, tween1Expect, tween2Expect) {
      const lastCallVal = mockFn => mockFn.mock.calls[mockFn.mock.calls.length - 1][0]
      multi.gotoElapsedTime(time)
      expect(lastCallVal(tween1.callback)).toBeCloseTo(tween1Expect)
      expect(lastCallVal(tween2.callback)).toBeCloseTo(tween2Expect)
    }
    testTime(500, 5, 12.5)
    testTime(2600, 6, 13)
    testTime(5500, 10, 17.5)
    testTime(9500, 10, 20)
  })
})

describe('direction', () => {
  test('reverse: runs all child tweens in reverse', () => {
    const tween1 = new Tween(jest.fn(), 0, 10, 1000)
    const tween2 = new Tween(jest.fn(), 10, 20, 2000)
    const multi = new MultiTween([tween1, tween2], undefined, 0, 'linear', 4, 'reverse')
    function testTime(time, tween1Expect, tween2Expect) {
      const lastCallVal = mockFn => mockFn.mock.calls[mockFn.mock.calls.length - 1][0]
      multi.gotoElapsedTime(time)
      expect(lastCallVal(tween1.callback)).toBeCloseTo(tween1Expect)
      expect(lastCallVal(tween2.callback)).toBeCloseTo(tween2Expect)
    }
    testTime(1500, 5, 12.5)
    testTime(3400, 6, 13)
    testTime(4500, 10, 17.5)
    testTime(9500, 0, 10)
  })
})



