import React from 'react'
import T from 'prop-types'
import {Canvas3D, Group3DFacade} from 'troika-3d'
import {Plane, Vector3, Matrix4} from 'three'
import Planet from './Planet'
import Sun from './Sun'
import Orbit from './Orbit'
import find from 'lodash/find'


const ORBITAL_PLANE_ROTATEX = -Math.PI / 3


class DragDropExample extends React.Component {
  constructor(props) {
    super(props)

    this._getInitialState = this._getInitialState.bind(this)
    this._reset = this._reset.bind(this)
    this._onCameraRef = this._onCameraRef.bind(this)
    this._onPlanetMouseOver = this._onPlanetMouseOver.bind(this)
    this._onPlanetMouseOut = this._onPlanetMouseOut.bind(this)
    this._onPlanetDragStart = this._onPlanetDragStart.bind(this)
    this._onPlanetDrag = this._onPlanetDrag.bind(this)
    this._onPlanetDragEnd = this._onPlanetDragEnd.bind(this)
    this._onPlanetDragEnter = this._onPlanetDragEnter.bind(this)
    this._onPlanetDragLeave = this._onPlanetDragLeave.bind(this)
    this._onPlanetDrop = this._onPlanetDrop.bind(this)

    this.state = this._getInitialState()
  }

  _getInitialState() {
    // Generate planets
    let planets = []
    for (let i = 0; i < 10; i++) {
      planets.push({
        id: `box${i}`,
        radius: .02 + Math.random() * .08,
        distance: .5 + i * .2,
        color: Math.round(Math.random() * 0xffffff),
        initialAngle: Math.random() * Math.PI * 2
      })
    }

    return {
      planets: planets,
      hoveredPlanet: null,
      draggedPlanet: null
    }
  }

  _reset() {
    this.setState(this._getInitialState())
  }

  _onCameraRef(ref) {
    this._cameraFacade = ref
  }

  _onPlanetMouseOver(e) {
    this.setState({hoveredPlanet: e.target.id})
  }

  _onPlanetMouseOut() {
    this.setState({hoveredPlanet: null})
  }

  _onPlanetDragStart(e) {
    this.setState({draggedPlanet: e.target.id})
  }

  _onPlanetDrag(e) {
    // Determine event's point on the orbital plane
    let systemTransformMatrix = new Matrix4().makeRotationX(ORBITAL_PLANE_ROTATEX)
    let systemPlane = new Plane().setComponents(0, 0, 1, 0).applyMatrix4(systemTransformMatrix)
    let ray = e.ray //all pointer events in a 3D world are guaranteed to have a `ray`
    let posVec3 = ray.intersectPlane(systemPlane, new Vector3())
    if (posVec3) {
      posVec3.applyMatrix4(new Matrix4().getInverse(systemTransformMatrix))

      // Update dragged planet's current angle and distance
      let planetData = find(this.state.planets, {id: e.target.id})
      planetData.initialAngle = posVec3.x === 0 ? 0 : Math.atan(posVec3.y / posVec3.x) + (posVec3.x < 0 ? Math.PI : 0)
      planetData.distance = Math.sqrt(posVec3.x * posVec3.x + posVec3.y * posVec3.y)
      this.forceUpdate()
    }
  }

  _onPlanetDragEnd(e) {
    this.setState({
      draggedPlanet: null,
      droppablePlanet: null
    })
  }

  _onPlanetDragEnter(e) {
    this.setState({droppablePlanet: e.target.id})
  }

  _onPlanetDragLeave(e) {
    this.setState({droppablePlanet: null})
  }

  _onPlanetDrop(e) {
    let {draggedPlanet, droppablePlanet, planets} = this.state
    draggedPlanet = find(planets, {id: draggedPlanet})
    droppablePlanet = find(planets, {id: droppablePlanet})
    if (draggedPlanet && droppablePlanet) {
      // Merge the two planets into a bigger one
      droppablePlanet.radius = Math.cbrt(Math.pow(draggedPlanet.radius, 3) + Math.pow(droppablePlanet.radius, 3))
      droppablePlanet.color = (draggedPlanet.color + droppablePlanet.color) / 2
      planets.splice(planets.indexOf(draggedPlanet), 1)
      this._onPlanetDragEnd()
    }
  }

  render() {
    let state = this.state
    let {width, height} = this.props

    return (
      <div>
        <style type="text/css">@import url("dragdrop/styles.css")</style>

        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={ width }
          height={ height }
          className={ state.draggedPlanet ? 'dragging' : state.hoveredPlanet ? 'draggable' : null }
          lights={ [
            { type: 'ambient', color: 0x666666 },
            { type: 'point', color: 0xffffff }
          ] }
          camera={ {
            z: 4,
            ref: this._onCameraRef
          } }
          objects={ {
            key: 'system',
            facade: Group3DFacade,
            rotateX: ORBITAL_PLANE_ROTATEX,
            children: state.planets.map((planet, i) => {
              let isDraggedPlanet = state.draggedPlanet === planet.id
              let isDroppablePlanet = state.droppablePlanet === planet.id
              let isHoveredPlanet = state.hoveredPlanet === planet.id

              return {
                key: planet.id,
                facade: Group3DFacade,

                rotateZ: planet.initialAngle,

                animation: isDraggedPlanet ? [] : {
                  from: {rotateZ: planet.initialAngle},
                  to: {rotateZ: planet.initialAngle + Math.PI * 2},
                  duration: 15000 * Math.sqrt(Math.pow(planet.distance, 3)), //very basic, probably incorrect, orbital period
                  iterations: Infinity,
                  paused: isHoveredPlanet || isDroppablePlanet
                },

                children: [
                  {
                    key: 'planet',
                    facade: Planet,
                    id: planet.id,
                    x: planet.distance, //distance from sun
                    radius: planet.radius,
                    color: isDroppablePlanet ? 0xcccccc : planet.color,
                    opacity: isDraggedPlanet && state.droppablePlanet ? 0 : (isHoveredPlanet || isDraggedPlanet || isDroppablePlanet) ? 1 : 0.8,

                    pointerEvents: !isDraggedPlanet,

                    onMouseOver: this._onPlanetMouseOver,
                    onMouseOut: this._onPlanetMouseOut,

                    onDragStart: this._onPlanetDragStart,
                    onDrag: this._onPlanetDrag,
                    onDragEnd: this._onPlanetDragEnd,

                    onDragEnter: !isDraggedPlanet && this._onPlanetDragEnter,
                    onDragLeave: !isDraggedPlanet && this._onPlanetDragLeave,
                    onDrop: !isDraggedPlanet && this._onPlanetDrop,

                    transition: {radius: {easing: 'easeOutBounce'}}
                  },
                  {
                    key: 'orbitpath',
                    facade: Orbit,
                    distance: planet.distance
                  }
                ]
              }
            }).concat({
              key: 'sun',
              facade: Sun
            })
          } }
        />

        <div className="example_desc">
          <p>This example demonstrates use of drag-and-drop events. Drag planets to different orbits, or merge them by dropping on one another.</p>
        </div>

        <div className="example_controls">
          <button onClick={ this._reset }>Reset</button>
        </div>
      </div>
    )
  }
}

DragDropExample.propTypes = {
  width: T.number,
  height: T.number
}

export default DragDropExample
