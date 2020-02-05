import {_assign, assign, assignIf, forOwn, getIdForObject, createClassExtender, isReactElement} from '../src/utils.js'
import React from 'react'



describe('assign', () => {
  test('Uses Object.assign if available', () => {
    // Test runner env should always have this
    // TODO can we test the negative case?
    expect(assign).toBe(Object.assign)
  })

  test('Returns the first arg', () => {
    const tgt = {one: 1}
    const result = _assign(tgt, {two: 2})
    expect(result).toBe(tgt)
  })

  test('Copies from second arg onto the first arg', () => {
    const tgt = {one: 1}
    _assign(tgt, {two: 2})
    expect(tgt).toEqual(expect.objectContaining({one: 1, two: 2}))
  })

  test('Overwrites properties of the same name', () => {
    const tgt = {one: 1, two: 2}
    _assign(tgt, {one: 11})
    expect(tgt).toEqual(expect.objectContaining({one: 11, two: 2}))
  })

  test('Allows multiple sources', () => {
    const tgt = {one: 1}
    _assign(tgt, {two: 2}, {three: 3}, {two: 22})
    expect(tgt).toEqual(expect.objectContaining({one: 1, two: 22, three: 3}))
  })

  test('Skips falsy args', () => {
    const tgt = {one: 1}
    _assign(tgt, null, {two: 2}, false, {three: 3}, 0, {two: 22})
    expect(tgt).toEqual(expect.objectContaining({one: 1, two: 22, three: 3}))
  })
})

describe('assignIf', () => {
  test('Returns the first arg', () => {
    const tgt = {one: 1}
    const result = assignIf(tgt, {two: 2})
    expect(result).toBe(tgt)
  })

  test('Copies from second arg onto the first arg', () => {
    const tgt = {one: 1}
    assignIf(tgt, {two: 2})
    expect(tgt).toEqual(expect.objectContaining({one: 1, two: 2}))
  })

  test('Does not overwrite properties of the same name', () => {
    const tgt = {one: 1, two: 2}
    assignIf(tgt, {one: 11})
    expect(tgt).toEqual(expect.objectContaining({one: 1, two: 2}))
  })

  test('Allows multiple sources', () => {
    const tgt = {one: 1}
    assignIf(tgt, {two: 2}, {three: 3}, {two: 22, three: 33})
    expect(tgt).toEqual(expect.objectContaining({one: 1, two: 2, three: 3}))
  })

  test('Skips falsy args', () => {
    const tgt = {one: 1}
    assignIf(tgt, null, {two: 2}, false, {three: 3}, 0, {two: 22})
    expect(tgt).toEqual(expect.objectContaining({one: 1, two: 2, three: 3}))
  })
})

describe('forOwn', () => {
  test('Invokes fn for each own property', () => {
    const obj = {one: 1, two: 2, three: 3}
    const cb = jest.fn()
    forOwn(obj, cb)
    expect(cb).toHaveBeenCalledTimes(3)
  })

  test('Invokes fn with `scope` arg as `this`', () => {
    const obj = {one: 1}
    let thisWas
    const cb = jest.fn(function() {
      thisWas = this
    })
    const scopeObj = {}
    forOwn(obj, cb, scopeObj)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(thisWas).toBe(scopeObj)
  })

  test('Invokes fn with (value, key, obj) args', () => {
    const obj = {one: 1, two: 2, three: 3}
    const cb = jest.fn()
    forOwn(obj, cb)
    expect(cb).toHaveBeenCalledTimes(3)
    expect(cb).toHaveBeenCalledWith(1, 'one', obj)
    expect(cb).toHaveBeenCalledWith(2, 'two', obj)
    expect(cb).toHaveBeenCalledWith(3, 'three', obj)
  })

  test('Does not invoke fn for properties inherited from prototype', () => {
    const proto = {protoOne: 1, protoTwo: 2}
    const obj = Object.create(proto)
    obj.one = 1
    obj.two = 2
    const cb = jest.fn()
    forOwn(obj, cb)
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenCalledWith(1, 'one', obj)
    expect(cb).toHaveBeenCalledWith(2, 'two', obj)
  })
})

describe('getIdForObject', () => {
  test('Returns a string', () => {
    const obj = {}
    const id = getIdForObject(obj)
    expect(typeof id).toBe('string')
  })
  test('Returns the same id for the same object', () => {
    const obj1 = {}
    const id1 = getIdForObject(obj1)
    const id2 = getIdForObject(obj1)
    expect(id1).toEqual(id2)
  })
  test('Returns different ids for different objects', () => {
    const obj1 = {}
    const obj2 = {}
    const id1 = getIdForObject(obj1)
    const id2 = getIdForObject(obj2)
    expect(id1).not.toEqual(id2)
  })
})

describe('createClassExtender', () => {
  test('Returns a function', () => {
    expect(createClassExtender('foo', () => {})).toEqual(expect.any(Function))
  })

  describe('Calling the function', () => {
    test('Calling the function invokes doExtend with the classToExtend argument', () => {
      class ClassToExtend {}
      class ExtendedClass extends ClassToExtend {}
      const spy = jest.fn(() => ExtendedClass)
      const extend = createClassExtender('foo', spy)
      extend(ClassToExtend)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(ClassToExtend)
    })

    test('The function returns the result of doExtend', () => {
      class ClassToExtend {}
      class ExtendedClass extends ClassToExtend {}
      const spy = jest.fn(() => ExtendedClass)
      const extend = createClassExtender('foo', spy)
      const result = extend(ClassToExtend)
      expect(result).toBe(ExtendedClass)
    })

    test('Calling it a second time for the same class returns the same result without calling doExtend', () => {
      class ClassToExtend {}
      class ExtendedClass extends ClassToExtend {}
      const spy = jest.fn(() => ExtendedClass)
      const extend = createClassExtender('foo', spy)
      const result1 = extend(ClassToExtend)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(result1).toBe(ExtendedClass)
      const result2 = extend(ClassToExtend)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(result2).toBe(ExtendedClass)
    })
  })

  describe('Calling createClassExtender with two different names and the same class', () => {
    test('Calls the appropriate doExtend', () => {
      class ClassToExtend {}
      class ExtendedClass1 extends ClassToExtend {}
      class ExtendedClass2 extends ClassToExtend {}
      const spy1 = jest.fn(() => ExtendedClass1)
      const spy2 = jest.fn(() => ExtendedClass2)
      const extend1 = createClassExtender('foo1', spy1)
      const extend2 = createClassExtender('foo2', spy2)
      const result1 = extend1(ClassToExtend)
      expect(spy1).toHaveBeenCalledTimes(1)
      expect(spy1).toHaveBeenCalledWith(ClassToExtend)
      expect(result1).toBe(ExtendedClass1)
      const result2 = extend2(ClassToExtend)
      expect(spy2).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledWith(ClassToExtend)
      expect(result2).toBe(ExtendedClass2)
    })
  })
})

describe('isReactElement', () => {
  test('Returns true for a React element', () => {
    expect(isReactElement(React.createElement('span', {foo:'bar'}))).toBe(true)
    expect(isReactElement(React.createElement(props => {}, {foo:'bar'}))).toBe(true)
  })

  test('Returns false for anything else', () => {
    expect(isReactElement({})).toBe(false)
    expect(isReactElement(function() {})).toBe(false)
    expect(isReactElement(5)).toBe(false)
    expect(isReactElement(true)).toBe(false)
    expect(isReactElement('hello')).toBe(false)
  })
})

