import Facade from '../../src/facade/Facade.js'
import ParentFacade from '../../src/facade/ParentFacade.js'
import { extendAsAnimatable } from '../../src/facade/Animatable.js'
import { extendAsPointerStatesAware } from '../../src/facade/PointerStates.js'
import React from 'react'


test('Extends the Facade class', () => {
  expect(Object.getPrototypeOf(ParentFacade)).toBe(Facade)
})

describe('constructor', () => {
  test('Sets `children` property to null', () => {
    const inst = new ParentFacade()
    expect(inst.children).toBe(null)
  })
})

describe('afterUpdate', () => {
  test('Calls `shouldUpdateChildren` method', () => {
    const inst = new ParentFacade()
    inst.shouldUpdateChildren = jest.fn(() => true)
    inst.afterUpdate()
    expect(inst.shouldUpdateChildren).toHaveBeenCalledTimes(1)
  })
  test('Calls `updateChildren` when `shouldUpdateChildren` is not overridden', () => {
    const inst = new ParentFacade()
    inst.updateChildren = jest.fn()
    const children = inst.children = []
    inst.afterUpdate()
    expect(inst.updateChildren).toHaveBeenCalledTimes(1)
    expect(inst.updateChildren).toHaveBeenCalledWith(children)
  })
  test('Calls `updateChildren` if a custom `shouldUpdateChildren` returns true', () => {
    const inst = new ParentFacade()
    inst.shouldUpdateChildren = () => true
    inst.updateChildren = jest.fn()
    const children = inst.children = []
    inst.afterUpdate()
    expect(inst.updateChildren).toHaveBeenCalledTimes(1)
    expect(inst.updateChildren).toHaveBeenCalledWith(children)
  })
  test('Does not call `updateChildren` if a custom `shouldUpdateChildren` returns false', () => {
    const inst = new ParentFacade()
    inst.shouldUpdateChildren = () => false
    inst.updateChildren = jest.fn()
    const children = inst.children = []
    inst.afterUpdate()
    expect(inst.updateChildren).not.toHaveBeenCalled()
  })
})

describe('updateChildren', () => {
  describe('when `children` is an array', () => {
    test('Throws if a descriptor\'s `facade` does not point to a function', () => {
      const inst = new ParentFacade()
      expect(() => {
        inst.updateChildren([{}])
      }).toThrow()
      expect(() => {
        inst.updateChildren([{facade: '1234'}])
      }).toThrow()
    })
    test('Instantiates the class referred to by `facade` with the parent as arg', () => {
      const spy = jest.fn()
      let childInstance
      class Sub extends Facade {constructor(parent) {
        super(parent)
        spy(parent)
        childInstance = this
      }}
      const inst = new ParentFacade()
      inst.updateChildren([{facade: Sub}])
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(inst)
      expect(childInstance).toEqual(expect.any(Sub))
    })
    describe('Instantiates an Animatable-wrapped class if one of the animation props is present', () => {
      ['transition', 'animation', 'exitAnimation'].forEach(propName => {
        test(propName, () => {
          let childInstance
          class Sub extends Facade {constructor(parent) {
            super(parent)
            childInstance = this
          }}
          const inst = new ParentFacade()
          inst.updateChildren([{
            facade: Sub,
            [propName]: {}
          }])
          expect(childInstance).toEqual(expect.any(extendAsAnimatable(Sub)))
        })
      })
    })
    test('Instantiates a PointerStates-wrapped class if the `pointerStates` prop is present', () => {
      let childInstance
      class Sub extends Facade {constructor(parent) {
        super(parent)
        childInstance = this
      }}
      const inst = new ParentFacade()
      inst.updateChildren([{
        facade: Sub,
        pointerStates: {}
      }])
      expect(childInstance).toEqual(expect.any(extendAsPointerStatesAware(Sub)))
    })
    test('Copies properties from the descriptor to the child instance', () => {
      let childInstance
      class Sub extends Facade {constructor(parent) {
        super(parent)
        childInstance = this
      }}
      const inst = new ParentFacade()
      inst.updateChildren([{
        facade: Sub,
        one: 1,
        two: true,
        three: 'three'
      }])
      expect(childInstance).toEqual(expect.objectContaining({one: 1, two: true, three: 'three'}))
    })
    test('Does not copy special descriptor properties', () => {
      let childInstance
      class Sub extends Facade {constructor(parent) {
        super(parent)
        childInstance = this
      }}
      const inst = new ParentFacade()
      inst.updateChildren([{
        facade: Sub,
        key: 'foo'
      }])
      expect(childInstance.facade).toBeUndefined()
      expect(childInstance.key).toBeUndefined()
    })
    test('Calls `afterUpdate` on the child instance', () => {
      const spy = jest.fn()
      class Sub extends Facade {
        afterUpdate() {
          spy()
          expect(this.one).toBe(1)
          expect(this.two).toBe(true)
          expect(this.three).toBe('three')
        }
      }
      const inst = new ParentFacade()
      inst.updateChildren([{
        facade: Sub,
        one: 1,
        two: true,
        three: 'three'
      }])
      expect(spy).toHaveBeenCalledTimes(1)
    })
    test('Skips falsy `children` descriptor members', () => {
      const childInstances = []
      class Sub extends Facade {constructor(parent) {
        super(parent)
        childInstances.push(this)
      }}
      const inst = new ParentFacade()
      inst.updateChildren([
        {facade: Sub, foo: 1},
        null,
        {facade: Sub, foo: 2},
        false,
        {facade: Sub, foo: 3}
      ])
      expect(childInstances.length).toBe(3)
      ;[0, 1, 2].forEach(n => {
        expect(childInstances[n].foo).toBe(n + 1)
      })
    })
    test('Treats a single `children` object as a one-item array', () => {
      const spy = jest.fn()
      let childInstance
      class Sub extends Facade {constructor(parent) {
        super(parent)
        spy(parent)
        childInstance = this
      }}
      const inst = new ParentFacade()
      inst.updateChildren({facade: Sub})
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(inst)
      expect(childInstance).toEqual(expect.any(Sub))
    })
    test('When a child with a given `key` is changed, its facade is updated', () => {
      let prevChildInstance
      let lastChildInstance
      class Sub extends Facade {
        constructor(parent) {
          super(parent)
          lastChildInstance = this
        }
      }
      const inst = new ParentFacade()
      inst.updateChildren([{key: 'foo', facade: Sub, one: 1, two: true}])
      expect(lastChildInstance).toEqual(expect.objectContaining({one: 1, two: true}))
      prevChildInstance = lastChildInstance
      inst.updateChildren([{key: 'foo', facade: Sub, one: 2, two: false}])
      expect(lastChildInstance).toBe(prevChildInstance)
      expect(lastChildInstance).toEqual(expect.objectContaining({one: 2, two: false}))
    })
    test('When a child with a given `key` goes away, its facade is destroyed', () => {
      let lastChildInstance
      const destructorSpy = jest.fn()
      class Sub extends Facade {
        constructor(parent) {
          super(parent)
          lastChildInstance = this
        }
        destructor() {
          destructorSpy(this.name)
          super.destructor()
        }
      }
      const inst = new ParentFacade()
      inst.updateChildren([
        {key: 'one', facade: Sub, name: 'one'},
        {key: 'two', facade: Sub, name: 'two'},
        {key: 'three', facade: Sub, name: 'three'},
      ])
      inst.updateChildren([
        {key: 'one', facade: Sub, name: 'one'},
        {key: 'three', facade: Sub, name: 'three'}
      ])
      expect(destructorSpy).toHaveBeenCalledTimes(1)
      expect(destructorSpy).toHaveBeenCalledWith('two')
    })
    test('When a child with a given `key` has its `facade` class changed, the old one is destroyed and new one created', () => {
      let prevChildInstance
      let lastChildInstance
      const destructorSpy = jest.fn()
      class Sub1 extends Facade {
        constructor(parent) {
          super(parent)
          lastChildInstance = this
        }
        destructor() {
          destructorSpy(this)
          super.destructor()
        }
      }
      class Sub2 extends Facade {
        constructor(parent) {
          super(parent)
          lastChildInstance = this
        }
        destructor() {
          destructorSpy(this)
          super.destructor()
        }
      }
      const inst = new ParentFacade()
      inst.updateChildren([{key: 'foo', facade: Sub1, one: 1, two: true}])
      expect(lastChildInstance).toEqual(expect.any(Sub1))
      prevChildInstance = lastChildInstance
      inst.updateChildren([{key: 'foo', facade: Sub2, one: 2, two: false}])
      expect(lastChildInstance).not.toBe(prevChildInstance)
      expect(lastChildInstance).toEqual(expect.any(Sub2))
      expect(lastChildInstance).toEqual(expect.objectContaining({one: 2, two: false}))
      expect(destructorSpy).toHaveBeenCalledTimes(1)
      expect(destructorSpy).toHaveBeenCalledWith(prevChildInstance)
    })
    test('Allows duplicate keys but logs a warning', () => {
      const _origWarn = console.warn
      const childInstances = []
      class Sub extends Facade {
        constructor(parent) {
          super(parent)
          childInstances.push(this)
        }
      }
      try {
        console.warn = jest.fn()
        const inst = new ParentFacade()
        expect(() => {
          inst.updateChildren([
            {key: 'foo', facade: Sub},
            {key: 'foo', facade: Sub},
            {key: 'foo', facade: Sub}
          ])
        }).not.toThrow()
        expect(console.warn).toHaveBeenCalledTimes(2)
      } finally {
        console.warn = _origWarn
      }
      expect(childInstances.length).toBe(3)
      childInstances.forEach(child => {
        expect(child).toEqual(expect.any(Sub))
      })
    })
  })

  describe('when `children` is falsy', () => {
    test('Does nothing when there were no children', () => {
      expect(() => {
        const inst = new ParentFacade()
        inst.updateChildren(null)
      }).not.toThrow()
    })
    test('Destroys any previously created children', () => {
      const falsyValues = [null, undefined, false]
      for (let i = falsyValues.length; i--;) {
        const destructorSpy = jest.fn()
        class Sub extends Facade {
          destructor() {
            destructorSpy(this)
            super.destructor()
          }
        }
        const inst = new ParentFacade()
        inst.updateChildren([{key: 'foo', facade: Sub, one: 1, two: true}])
        inst.updateChildren(falsyValues[i])
        expect(destructorSpy).toHaveBeenCalledTimes(1)
        expect(destructorSpy).toHaveBeenCalledWith(expect.any(Sub))
      }
    })
  })
})

describe('getChildByKey', () => {
  test('Returns the facade instance for the given key', () => {
    let childInstance
    class Sub extends Facade {constructor(parent) {
      super(parent)
      childInstance = this
    }}
    const inst = new ParentFacade()
    inst.children = [{key:'foo', facade:Sub}]
    inst.afterUpdate()
    expect(inst.getChildByKey('foo')).toEqual(expect.any(Sub))
  })
  test('Returns null if none found', () => {
    let childInstance
    class Sub extends Facade {constructor(parent) {
      super(parent)
      childInstance = this
    }}
    const inst = new ParentFacade()
    inst.children = [{key:'foo', facade:Sub}]
    inst.afterUpdate()
    expect(inst.getChildByKey('bar')).toBe(null)
  })
})

describe('traverse', () => {
  test('Calls `fn` with each descendant facade in depth-first recursive order', () => {
    const root = new ParentFacade()
    root.name = 'ROOT'
    root.children = [
      {facade: ParentFacade, name: '1', children: [
        {facade: ParentFacade, name: '1.1', children: [
          {facade: ParentFacade, name: '1.1.1'},
          {facade: ParentFacade, name: '1.1.2'},
          {facade: ParentFacade, name: '1.1.3'}
        ]},
        {facade: ParentFacade, name: '1.2', children: [
          {facade: ParentFacade, name: '1.2.1'},
          {facade: ParentFacade, name: '1.2.2'},
        ]},
      ]},
      {facade: ParentFacade, name: '2', children: [
        {facade: ParentFacade, name: '2.1'},
        {facade: ParentFacade, name: '2.2'},
      ]}
    ]
    root.afterUpdate()
    const calls = []
    root.traverse(facade => {
      calls.push(facade.name)
    })
    expect(calls).toEqual(['ROOT', '1', '1.1', '1.1.1', '1.1.2', '1.1.3', '1.2', '1.2.1', '1.2.2', '2', '2.1', '2.2'])
  })
  test('Calls `fn` for children in order matching the `children` descriptor', () => {
    const root = new ParentFacade()
    root.name = 'ROOT'
    root.children = [
      {key: 'a', facade: ParentFacade, name: 'a'},
      {key: 'b', facade: ParentFacade, name: 'b'},
      {key: 'c', facade: ParentFacade, name: 'c'}
    ]
    root.afterUpdate()
    root.children = [
      {key: 'c', facade: ParentFacade, name: 'c'},
      {key: 'd', facade: ParentFacade, name: 'd'},
      {key: 'a', facade: ParentFacade, name: 'a'}
    ]
    root.afterUpdate()
    const calls = []
    root.traverse(facade => {
      calls.push(facade.name)
    })
    expect(calls).toEqual(['ROOT', 'c', 'd', 'a'])
  })
  test('Calls `fn` with `thisArg` as scope if provided', () => {
    const root = new ParentFacade()
    root.name = 'ROOT'
    root.children = [
      {key: 'a', facade: ParentFacade, name: 'a'},
      {key: 'b', facade: ParentFacade, name: 'b'},
      {key: 'c', facade: ParentFacade, name: 'c'}
    ]
    root.afterUpdate()
    const scope = {}
    root.traverse(function(facade) {
      expect(this).toBe(scope)
    }, scope)
  })
})

describe('forEachChild', () => {
  test('Calls `fn` with each direct child in order matching the `children` descriptor', () => {
    const root = new ParentFacade()
    root.name = 'ROOT'
    root.children = [
      {key: 'a', facade: ParentFacade, name: 'a'},
      {key: 'b', facade: ParentFacade, name: 'b'},
      {key: 'c', facade: ParentFacade, name: 'c'}
    ]
    root.afterUpdate()
    root.children = [
      {key: 'c', facade: ParentFacade, name: 'c'},
      {key: 'd', facade: ParentFacade, name: 'd'},
      {key: 'a', facade: ParentFacade, name: 'a'}
    ]
    root.afterUpdate()
    const calls = []
    root.forEachChild(facade => {
      calls.push(facade.name)
    })
    expect(calls).toEqual(['c', 'd', 'a'])
  })
  test('Calls `fn` with `thisArg` as scope if provided', () => {
    const root = new ParentFacade()
    root.name = 'ROOT'
    root.children = [
      {key: 'a', facade: ParentFacade, name: 'a'},
      {key: 'b', facade: ParentFacade, name: 'b'},
      {key: 'c', facade: ParentFacade, name: 'c'}
    ]
    root.afterUpdate()
    const scope = {}
    root.forEachChild(function(facade) {
      expect(this).toBe(scope)
    }, scope)
  })
})

describe('destructor', () => {
  test('Sets `isDestroying` to `true`', () => {
    const inst = new ParentFacade()
    inst.destructor()
    expect(inst.isDestroying).toBe(true)
  })
  test('Calls the `destructor` of all child facade instances', () => {
    const destructorSpy = jest.fn()
    class Sub extends Facade {
      destructor() {
        destructorSpy(this)
        super.destructor()
      }
    }
    const inst = new ParentFacade()
    inst.children = [
      {facade: Sub},
      {facade: Sub},
      {facade: Sub}
    ]
    inst.afterUpdate()
    inst.destructor()
    expect(destructorSpy).toHaveBeenCalledTimes(3)
    expect(destructorSpy).toHaveBeenCalledWith(expect.any(Sub))
  })
})

test('Allows React elements to be used as children descriptors', () => {
  class Sub extends ParentFacade {}
  const root = new Sub()
  root.val = 'ROOT'
  root.children = [
    React.createElement(Sub, {key: 'a', val: 'a'}, [
      React.createElement(Sub, {key: 'a.a', val: 'a.a'}),
      React.createElement(Sub, {key: 'a.b', val: 'a.b'})
    ]),
    <Sub key="b" val="b">
      <Sub key="b.a" val="b.a" />
      <Sub key="b.b" val="b.b" />
      <Sub key="b.c" val="b.c" />
    </Sub>,
    {key: 'c', facade: Sub, val: 'c', children: [
      {facade: Sub, val: 'c.a'},
      {facade: Sub, val: 'c.b'}
    ]}
  ]
  root.afterUpdate()
  const vals = []
  root.traverse(inst => {
    expect(inst).toEqual(expect.any(Sub))
    vals.push(inst.val)
  })
  expect(vals).toEqual(['ROOT', 'a', 'a.a', 'a.b', 'b', 'b.a', 'b.b', 'b.c', 'c', 'c.a', 'c.b'])
})
