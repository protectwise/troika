import { Group3DFacade } from 'troika-3d'
import { TimelineContainer } from './timeline/TimelineContainer.js'
import { getPastMonth, TimeRangePresets } from './timeline/TimeRangePresets.js'
import { TimeLineSeries } from './timeline/TimeLineSeries.js'
import { scaleTime } from 'd3-scale'

export class TimelineTest extends Group3DFacade {
  presetTimeRange = getPastMonth()

  describeChildren () {
    const [initialStartTime, initialEndTime] = this.presetTimeRange

    return [
      {
        facade: TimelineContainer,
        z: -1.5,
        y: 0.7,
        rotateX: Math.PI / 16,
        length: 3,
        height: 0.5,
        depth: 0.5,
        initialStartTime,
        initialEndTime,
        onRangeChange
      },
      {
        facade: TimelineContainer,
        z: -4,
        y: 1.5,
        rotateX: Math.PI / 2.5,
        length: 4,
        height: 1,
        depth: 1,
        initialStartTime,
        initialEndTime,
        onRangeChange
      },
      {
        facade: TimelineContainer,
        z: -0.5,
        y: 0.7,
        //rotateX: Math.PI / 8,
        length: 4,
        height: 0.2,
        depth: 0.3,
        initialStartTime,
        initialEndTime,
        onRangeChange
      },
      {
        facade: TimeRangePresets,
        x: 1,
        z: -1,
        y: 1,
        rotateY: -Math.PI / 4,
        onSelect: (start, end) => {
          this.update({ presetTimeRange: [start, end] })
        }
      }
    ]
  }
}

function onRangeChange (startTime, endTime) {
  clearTimeout(this._dataTimer)
  this._dataTimer = setTimeout(() => {
    const data1 = []
    const data2 = []
    const data3 = []
    const buffer = (endTime - startTime) / 2
    const times = scaleTime().domain([startTime - buffer, endTime + buffer]).ticks(50)
    const dt = endTime - startTime
    const maxValue = dt
    for (let time of times) {
      data1.push({ time, value: maxValue * (Math.cos(time) * Math.sin(time * 1.1) / 2 + 0.5) })
      data2.push({ time, value: maxValue * (Math.sin(time) * Math.cos(time * 2.3) / 2 + 0.5) })
      data3.push({ time, value: maxValue * (Math.sin(time) * Math.cos(time * 0.7) / 2 + 0.5) })
    }

    this.update({
      minValue: 0,
      maxValue,
      children: [
        {
          key: 'timeseries1',
          facade: TimeLineSeries,
          //castShadow: true,
          data: data1,
          color: 0x3366cc,
          thickness: 0.007,
          depth: this.depth * 0.2,
          z: -this.depth * 0.7,
          //transition: transitionData
        },
        {
          key: 'timeseries2',
          facade: TimeLineSeries,
          //castShadow: true,
          data: data2,
          color: 0xcc3366,
          thickness: 0.01,
          depth: this.depth * 0.1,
          z: -this.depth * 0.4,
          // animation: {
          //   from: {curviness: 0},
          //   to: {curviness: 1},
          //   direction: 'alternate',
          //   iterations: Infinity,
          //   duration: 1000
          //}
          //transition: transitionData
        },
        {
          key: 'timeseries3',
          facade: TimeLineSeries,
          //castShadow: true,
          data: data3,
          color: 0x339933,
          thickness: 0.002,
          depth: this.depth * 0.2,
          z: -this.depth * 0.1,
          curviness: 0.001,
          //transition: transitionData
        }
      ]
    })
  }, 300)
}

function interpolateArray(arrA, arrB, t) {
  const byTimeA = arrA.reduce((out, d) => { out[d.time] = d.value; return out }, Object.create(null))
  return arrB.map(({time, value: b}) => {
    const a = byTimeA[time] || 0
    return {
      time,
      value: t <= 0 ? a : t >= 1 ? b : a + (b - a) * t
    }
  })
}

const transitionData = {
  data: {
    duration: 500,
    easing: 'easeOutExpo',
    interpolate: interpolateArray
  }
}
