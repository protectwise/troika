import { LineSeries } from './LineSeries.js'
import memoizeOne from 'memoize-one'
import { Vector4 } from 'three'

/**
 * @typedef TimeSeriesGraphDataPoint
 * @member {number} time
 * @member {number} value
 */

export class TimeLineSeries extends LineSeries {
  /**
   * @type {TimeSeriesGraphDataPoint[]}
   * Treated as immutable
   */
  data = []

  /**
   * @type {function}
   */
  valueScale = null

  /**
   * @type {function}
   */
  timeScale = null

  edgeFade = new Vector4()

  _calcPoints = memoizeOne((data, minTime, maxTime, minX, maxX) => {
    // Map time series datapoints to x/y points
    const { timeScale, valueScale } = this
    const buffer = (maxTime - minTime) * 0.1 //slight buffer past fade
    minTime -= buffer
    maxTime += buffer
    data.sort((a, b) => a.time - b.time)
    this.points = []
    for (let { time, value } of data) {
      if (time >= minTime && time <= maxTime) {
        this.points.push({
          x: timeScale(time),
          y: valueScale(value)
        })
      }
    }
  })

  afterUpdate () {
    let { timeScale, valueScale, data } = this
    if (timeScale && valueScale) {
      const [minTime, maxTime] = timeScale.domain()
      const [minX, maxX] = timeScale.range()
      this._calcPoints(data, +minTime, +maxTime, minX, maxX)
      this.edgeFade.set(minX, minX + (maxX - minX) * 0.1, maxX - (maxX - minX) * 0.1, maxX)
    }
    super.afterUpdate()
  }
}
