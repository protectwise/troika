const promisesAplusTests = require('promises-aplus-tests')
import BasicThenable from '../src/BasicThenable'

/**
 * Compliance tests for BasicThenable
 * We use the `promises-aplus-tests` suite to run a full Promises/A+ compliance test
 */

// simple bridge from mocha `specify` to jest `test`
global.specify = test

promisesAplusTests.mocha({
  deferred() {
    const thenable = new BasicThenable()
    return {
      promise: thenable,
      resolve: thenable.resolve,
      reject: thenable.reject
    }
  }
})

