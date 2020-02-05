import Facade from '../../src/facade/Facade.js'



describe('constructor', () => {
  test('Instantiates', () => {
    function instantiate() {
      const par = new Facade(null)
      return new Facade(par)
    }
    expect(instantiate).not.toThrow()
    expect(instantiate()).toEqual(expect.any(Facade))
  })
  test('Has a unique `$facadeId` property assigned', () => {
    const facade1 = new Facade(null)
    const facade2 = new Facade(facade1)
    expect(facade1.$facadeId).toEqual(expect.any(String))
    expect(facade2.$facadeId).toEqual(expect.any(String))
    expect(facade1.$facadeId).not.toEqual(facade2.$facadeId)
  })
  test('Stores constructor arg as `parent` property', () => {
    const facade1 = new Facade(null)
    const facade2 = new Facade(facade1)
    expect(facade1.parent).toBe(null)
    expect(facade2.parent).toBe(facade1)
  })
})

describe('afterUpdate', () => {
  describe('`ref` property', () => {
    test('If a function, calls it with the facade instance as sole argument', () => {
      const facade = new Facade()
      const spy = facade.ref = jest.fn()
      facade.afterUpdate()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(facade)
    })
    test('If did not change since last update, does not call `ref` function', function () {
      const facade = new Facade()
      const spy = facade.ref = jest.fn()
      facade.afterUpdate()
      facade.afterUpdate()
      facade.afterUpdate()
      facade.afterUpdate()
      expect(spy).toHaveBeenCalledTimes(1)
    })
    test('If changed since last update, previous `ref` function is called with `null` as sole argument', () => {
      const facade = new Facade()
      const calls = []
      facade.ref = function(...args) {
        calls.push({refNum:1, args})
      }
      facade.afterUpdate()
      facade.ref = function(...args) {
        calls.push({refNum:2, args})
      }
      facade.afterUpdate()
      expect(calls).toEqual([{refNum:1, args:[facade]}, {refNum:1, args:[null]}, {refNum:2, args:[facade]}])
    })
    test('If not a function, does not throw', () => {
      expect(() => {
        const facade = new Facade()
        facade.ref = 'hello'
        facade.afterUpdate()
        facade.ref = 123
        facade.afterUpdate()
        facade.ref = true
        facade.afterUpdate()
        facade.ref = function() {}
        facade.afterUpdate()
      }).not.toThrow()
    })
  })
})

describe('notifyWorld', () => {
  test('Calls its parent\'s `onNotifyWorld` method with correct scope and args', () => {
    const parent = {
      onNotifyWorld: jest.fn()
    }
    const facade = new Facade(parent)
    const data = {foo: 'bar'}
    facade.notifyWorld('message_name', data)
    expect(parent.onNotifyWorld).toHaveBeenCalledTimes(1)
    expect(parent.onNotifyWorld).toHaveBeenCalledWith(facade, 'message_name', data)
  })
  test('If no parent, does not throw', () => {
    expect(() => {
      new Facade(null).notifyWorld('hi', {})
    }).not.toThrow()
  })
  test('Bubbles up through multiple ancestor facades', () => {
    const parent = {
      onNotifyWorld: jest.fn()
    }
    const facade = new Facade(new Facade(new Facade(new Facade(parent))))
    const data1 = {foo: 'bar'}
    const data2 = {foo: 'bar'}
    facade.notifyWorld('message_1', data1)
    facade.notifyWorld('message_2', data2)
    expect(parent.onNotifyWorld).toHaveBeenCalledTimes(2)
    expect(parent.onNotifyWorld).toHaveBeenCalledWith(facade, 'message_1', data1)
    expect(parent.onNotifyWorld).toHaveBeenCalledWith(facade, 'message_2', data2)
  })
})

describe('traverse', () => {
  test('Invokes `fn` only once with this instance as argument', () => {
    const facade = new Facade()
    const spy = jest.fn()
    facade.traverse(spy)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(facade)
  })
})

describe('forEachChild', () => {
  test('Does not call `fn`', () => {
    const facade = new Facade()
    const spy = jest.fn()
    facade.forEachChild(spy)
    expect(spy).toHaveBeenCalledTimes(0)
  })
})

describe('addEventListener', () => {
  test('Notifies with "addEventListener" message and {type, handler} data arg', () => {
    const parent = {
      onNotifyWorld: jest.fn()
    }
    const facade = new Facade(parent)
    const handler = function() {}
    facade.addEventListener('asdfasdf', handler)
    expect(parent.onNotifyWorld).toHaveBeenCalledTimes(1)
    expect(parent.onNotifyWorld).toHaveBeenCalledWith(facade, 'addEventListener', {type:'asdfasdf', handler})
  })
})

describe('removeEventListener', () => {
  test('Notifies with "addEventListener" message and {type, handler} data arg', () => {
    const parent = {
      onNotifyWorld: jest.fn()
    }
    const facade = new Facade(parent)
    const handler = function() {}
    facade.removeEventListener('asdfasdf', handler)
    expect(parent.onNotifyWorld).toHaveBeenCalledTimes(1)
    expect(parent.onNotifyWorld).toHaveBeenCalledWith(facade, 'removeEventListener', {type:'asdfasdf', handler})
  })
})

describe('destructor', () => {
  test('Notifies with "removeAllEventListeners" message', () => {
    const parent = {
      onNotifyWorld: jest.fn()
    }
    const facade = new Facade(parent)
    facade.destructor()
    expect(parent.onNotifyWorld).toHaveBeenCalledTimes(1)
    expect(parent.onNotifyWorld).toHaveBeenCalledWith(facade, 'removeAllEventListeners', undefined)
  })
  test('Calls a function `ref` property with `null` as sole argument', () => {
    const parent = new Facade()
    const facade = new Facade(parent)
    const ref = facade.ref = jest.fn()
    facade.destructor()
    expect(ref).toHaveBeenCalledTimes(1)
    expect(ref).toHaveBeenCalledWith(null)
  })
  test('Sets `parent` property to null', () => {
    const parent = new Facade()
    const facade = new Facade(parent)
    expect(facade.parent).toBe(parent)
    facade.destructor()
    expect(facade.parent).toBe(null)
  })
  test('Does not throw when there is no parent', () => {
    const facade = new Facade()
    expect(() => {
      facade.destructor()
    }).not.toThrow()
  })
})

test('Facade.isSpecialDescriptorProperty', () => {
  expect(Facade.isSpecialDescriptorProperty('key')).toBe(true)
  expect(Facade.isSpecialDescriptorProperty('class')).toBe(false)
  expect(Facade.isSpecialDescriptorProperty('facade')).toBe(true)
  expect(Facade.isSpecialDescriptorProperty('transition')).toBe(true)
  expect(Facade.isSpecialDescriptorProperty('animation')).toBe(true)
  expect(Facade.isSpecialDescriptorProperty('merp')).toBe(false)
  expect(Facade.isSpecialDescriptorProperty(5)).toBe(false)
  expect(Facade.isSpecialDescriptorProperty(true)).toBe(false)
})

describe('Facade.defineEventProperty', function () {
  test('Defines a property on the prototype whose name matches the `propName` arg', function () {
    const cls = class extends Facade {}
    Facade.defineEventProperty(cls, 'onFlerp', 'flerp')
    expect(cls.prototype.hasOwnProperty('onFlerp')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(cls.prototype, 'onFlerp')).toEqual(
      expect.objectContaining({
        get: expect.any(Function),
        set: expect.any(Function),
        enumerable: false,
        configurable: false
      })
    )
  })
  describe('Setting the `propName` property', function () {
    test('Setting to a function calls `addEventListener`', function () {
      const cls = class extends Facade {}
      Facade.defineEventProperty(cls, 'onFlerp', 'flerp')
      const inst = new cls()
      const spy = inst.addEventListener = jest.fn()
      const handler = function() {}
      inst.onFlerp = handler
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('flerp', handler)
    })
    test('Re-setting to a new function calls `removeEventListener` for the old function', function () {
      const cls = class extends Facade {}
      Facade.defineEventProperty(cls, 'onFlerp', 'flerp')
      const inst = new cls()
      const addSpy = inst.addEventListener = jest.fn()
      const removeSpy = inst.removeEventListener = jest.fn()
      const handler1 = function() {}
      const handler2 = function() {}
      inst.onFlerp = handler1
      expect(addSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledTimes(0)
      inst.onFlerp = handler2
      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith('flerp', handler1)
      expect(addSpy).toHaveBeenCalledTimes(2)
      expect(addSpy).toHaveBeenCalledWith('flerp', handler2)
    })
    test('Re-setting to same function does not call `addEventListener` or `removeEventListener`', function () {
      const cls = class extends Facade {}
      Facade.defineEventProperty(cls, 'onFlerp', 'flerp')
      const inst = new cls()
      const addSpy = inst.addEventListener = jest.fn()
      const removeSpy = inst.removeEventListener = jest.fn()
      const handler = function() {}
      inst.onFlerp = handler
      inst.afterUpdate()
      inst.onFlerp = handler
      inst.afterUpdate()
      expect(addSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledTimes(0)
    })
    test('Setting to non-function does not call `addEventListener` or `removeEventListener`', function () {
      const cls = class extends Facade {}
      Facade.defineEventProperty(cls, 'onFlerp', 'flerp')
      const inst = new cls()
      const addSpy = inst.addEventListener = jest.fn()
      const removeSpy = inst.removeEventListener = jest.fn()
      inst.onFlerp = 'hello'
      inst.onFlerp = true
      inst.onFlerp = {}
      inst.onFlerp = 12345
      inst.onFlerp = null
      expect(addSpy).toHaveBeenCalledTimes(0)
      expect(removeSpy).toHaveBeenCalledTimes(0)
    })
  })
  test('Getting the `propName` property returns the last set value', function () {
    const cls = class extends Facade {}
    Facade.defineEventProperty(cls, 'onFlerp', 'flerp')
    const inst = new cls()
    ;[function() {}, () => {}, 'merp', true, 123, {}].forEach(val => {
      inst.onFlerp = val
      expect(inst.onFlerp).toBe(val)
    })
  })
})
