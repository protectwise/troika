/*global require*/

// NOTE: I couldn't get the jsdom worker impl to work in this context, so for now
// it will just fall through to main-thread execution
// require('../../troika-worker-utils/__tests__/_jsdom-worker.js')
const { requestFlexLayout } = require('../src/FlexLayoutProcessor.js')

describe('requestFlexLayout', () => {
  function testFlexLayout(inputStyleTree, expectedResult) {
    return new Promise(resolve => {
      requestFlexLayout(inputStyleTree, result => {
        expect(result).toEqual(expectedResult)
        resolve()
      })
    })
  }

  test('layout', () => {
    return testFlexLayout(
      {
        id: 'root',
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        children: [
          {
            id: 'child',
            width: '50%',
            height: '50%'
          }
        ]
      },
      {
        root: { left: 0, top: 0, width: 100, height: 100 },
        child: { left: 25, top: 25, width: 50, height: 50 }
      }
    )
  })
})
