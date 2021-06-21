import { createDerivedMaterial, Group3DFacade, ListFacade, PlaneFacade } from 'troika-3d'
import { MeshBasicMaterial, Plane, Vector3 } from 'three'
import { scaleLinear } from 'd3-scale'
import { TickLine, TimeAxisTick } from './TimeAxisTick.js'

const tempPlane = new Plane()
const tempVec3 = new Vector3()

const fadeIn = {
  from: { fade: 0 },
  to: { fade: 1 },
  duration: 300
}

const planeMaterial = createDerivedMaterial(
  new MeshBasicMaterial({
    transparent: true,
    color: 0xcccccc,
    opacity: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  }),
  {
    vertexDefs: 'varying vec2 vUv;',
    vertexMainOutro: 'vUv = uv;',
    fragmentDefs: 'varying vec2 vUv;',
    fragmentColorTransform: `gl_FragColor.a *= min(1.0, min(vUv.x / 0.1, (1.0 - vUv.x) / 0.1));`
  }
)

export class TimeAxis extends Group3DFacade {
  timeScale = null //passed from parent
  numTicks = 6
  length = 1
  depth = 1
  _drags = new Map() //eventSource -> {initialTime, currentTime}

  onTimeRangeChange () {}

  // _nowTimer = setInterval(() => {
  //   this.update({ now: Date.now() })
  // }, 1000)

  _onDragStart = e => {
    const x = this._rayToLocalX(e.ray)
    const time = +this.timeScale.invert(x)
    this._drags.set(e.eventSource, { initialTime: time, currentTime: time })
  }

  _onDrag = e => {
    const x = this._rayToLocalX(e.ray)
    if (x != null) {
      this._drags.get(e.eventSource).currentTime = +this.timeScale.invert(x)
      clearTimeout(this._syncDragsTimer)
      this._syncDragsTimer = setTimeout(this._syncDrags, 1)
    }
  }

  _syncDrags = () => {
    const { timeScale, _drags: drags } = this
    const [startTime, endTime] = timeScale.domain()
    // Pan:
    if (drags.size === 1) {
      const { currentTime, initialTime } = [...drags.values()][0]
      const timeDelta = currentTime - initialTime
      if (timeDelta) {
        this.onTimeRangeChange(startTime - timeDelta, endTime - timeDelta)
      }
    } else if (drags.size === 2) {
      const sortedDrags = [...drags.values()].sort((a, b) => a.initialTime - b.initialTime)
      const initialTimes = sortedDrags.map(d => d.initialTime)
      const currentTimes = sortedDrags.map(d => d.currentTime)

      // Don't cross the streams!
      currentTimes[1] = Math.max(currentTimes[1], +timeScale.invert(timeScale(currentTimes[0]) + 0.1))

      // Create a scale to translate initial times to new positions, and use it to adjust the original time domain
      const adjustDomain = scaleLinear().domain(currentTimes).range(initialTimes)
      this.onTimeRangeChange(adjustDomain(+startTime), adjustDomain(+endTime))
    }
  }

  _onDragEnd = e => {
    this._drags.clear()
  }

  _onWheel = e => {
    const [startTime, endTime] = this.timeScale.domain()
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const midTime = +this.timeScale.invert(this._rayToLocalX(e.ray))
      const scaleBy = 1 + e.deltaY / 100
      this.onTimeRangeChange(
        midTime - (midTime - +startTime) * scaleBy,
        midTime + (+endTime - midTime) * scaleBy
      )
    } else {
      const deltaTime = this.timeScale.invert(e.deltaX / 100) - this.timeScale.invert(0)
      this.onTimeRangeChange(+startTime + deltaTime, +endTime + deltaTime)
    }
  }

  _opacityFromSides = t => {
    const [startTime, endTime] = this.timeScale.domain()
    const fadeDist = (endTime - startTime) / 10
    return Math.min(1, (t - startTime) / fadeDist, (endTime - t) / fadeDist)
  }

  children = [
    this.plane = {
      key: 'plane',
      facade: PlaneFacade,
      material: planeMaterial,
      onDragStart: this._onDragStart,
      onDrag: this._onDrag,
      onDragEnd: this._onDragEnd,
      onWheel: this._onWheel
    },
    this.ticksList = {
      key: 'ticks',
      facade: ListFacade,
      data: null,
      template: {
        key: t => t,
        facade: TimeAxisTick,
        timestamp: t => +t,
        timeScale: t => this.timeScale,
        index: (t, i) => i,
        height: t => this.depth / 4,
        depth: t => this.depth,
        opacity: this._opacityFromSides,
        animation: fadeIn
      }
    },
    this.minorTicksList = {
      key: 'minorTicks',
      facade: ListFacade,
      data: null,
      template: {
        key: t => t,
        facade: TickLine,
        x: t => this.timeScale(t),
        scaleZ: t => this.depth / 2,
        opacity: t => this._opacityFromSides(t) * 0.2,
        animation: fadeIn
      }
    }
  ]

  _rayToLocalX (ray) {
    tempPlane.setComponents(0, 1, 0, 0).applyMatrix4(this.threeObject.matrixWorld)
    const ix = ray.intersectPlane(tempPlane, tempVec3)
    if (!ix) return null
    this.threeObject.worldToLocal(tempVec3)
    return tempVec3.x
  }

  afterUpdate () {
    this.plane.width = this.length
    this.plane.depth = this.depth
    this.plane.z = this.depth / -2
    this.ticksList.data = this.timeScale.ticks(this.numTicks).map(Number)
    this.minorTicksList.data = this.timeScale.ticks(this.numTicks * 5).map(Number).filter(t => !this.ticksList.data.includes(t))

    // const { now } = this
    // const [startTime, endTime] = this.timeScale.domain()
    // if (now && now > startTime && now < endTime) {
    //   this.ticksList.data.push(now)
    // }
    super.afterUpdate()
  }

  destructor () {
    //clearInterval(this._nowTimer)
    super.destructor()
  }
}
