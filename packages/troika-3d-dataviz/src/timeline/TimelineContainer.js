import { Group3DFacade, ParentFacade } from 'troika-3d'
import { scaleLinear, scaleTime } from 'd3-scale'
import memoizeOne from 'memoize-one'
import { TimeAxis } from './TimeAxis.js'

let dummyArr = Object.freeze([])

/**
 * @member {number} startTime
 * @member {number} endTime
 * @member {number} length
 * @member {number} width
 */
export class TimelineContainer extends Group3DFacade {
  constructor (parent) {
    super(parent)
    this.length = 1
    this.depth = 0.25
    this.height = 0.25
    this.initialStartTime = 0
    this.initialEndTime = 0
    this.startTime = 0
    this.endTime = 0
    this.minValue = 0
    this.maxValue = 1
    this.onRangeChange = null

    this._onRangeChange = (startTime, endTime) => {
      // Apply some sane limits
      startTime = Math.max(startTime, 0)
      endTime = Math.max(Math.min(endTime, Date.now() + 365 * 24 * 60 * 60 * 1000), startTime + 10000)
      this.update({ startTime, endTime })
      this.onRangeChange?.(startTime, endTime)
    }
  }

  afterUpdate () {
    const { initialStartTime, initialEndTime } = this
    if (initialStartTime !== this._initialStartTime || initialEndTime !== this._initialEndTime) {
      this.startTime = this._initialStartTime = initialStartTime
      this.endTime = this._initialEndTime = initialEndTime
      this.onRangeChange?.(initialStartTime, initialEndTime)
    }
    super.afterUpdate()
  }

  describeChildren () {
    let { startTime, endTime, minValue, maxValue, length, height, depth } = this
    return {
      facade: TimeScaleProvider,
      startTime,
      endTime,
      minValue,
      maxValue,
      length,
      height,
      transition: {
        startTime: 'spring',
        endTime: 'spring',
        minValue: 'spring',
        maxValue: 'spring'
      },
      children: dummyArr.concat(
        this.children,
        {
          key: 'axis',
          facade: TimeAxis,
          length,
          depth,
          onTimeRangeChange: this._onRangeChange
        }
      )
    }
  }
}

class TimeScaleProvider extends ParentFacade {
  startTime = Date.now() - 1000
  endTime = Date.now()
  minValue = 0
  maxValue = 1
  length = 1
  height = 1

  // Memoized time scale builder that will be passed down to all children
  _getTimeScale = memoizeOne((startTime, endTime, length) => {
    return (endTime === startTime)
      ? null :
      scaleTime().domain([startTime, endTime]).range([-length / 2, length / 2])
  })

  _getValueScale = memoizeOne((minValue, maxValue, height) => {
    return (minValue === maxValue)
      ? null :
      scaleLinear().domain([minValue, maxValue]).range([0, height])
  })

  describeChildren () {
    const timeScale = this._getTimeScale(this.startTime, this.endTime, this.length)
    const valueScale = this._getValueScale(this.minValue, this.maxValue, this.height)
    return timeScale && valueScale ? this.children.map(kid => {
      if (kid) {
        kid.timeScale = timeScale
        kid.valueScale = valueScale
      }
      return kid
    }) : null
  }
}
