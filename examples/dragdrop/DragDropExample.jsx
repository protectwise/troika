import React from 'react'
import ReactDOM from 'react-dom'
import {Canvas3D, Group} from '../../src/index'
import {Plane, Vector2, Matrix4, Raycaster} from 'three'
import Planet from './Planet'
import Sun from './Sun'
import Orbit from './Orbit'
import find from 'lodash/find'


const ORBITAL_PLANE_ROTATEX = -Math.PI / 3


export default React.createClass({
  propTypes: {
    width: React.PropTypes.number,
    height: React.PropTypes.number
  },

  getInitialState() {
    // Generate planets
    let planets = []
    for (let i = 0; i < 10; i++) {
      planets.push({
        id: `box${i}`,
        radius: 2 + Math.random() * 8,
        distance: 50 + i * 20,
        color: Math.round(Math.random() * 0xffffff),
        initialAngle: Math.random() * Math.PI * 2
      })
    }

    return {
      planets: planets,
      hoveredPlanet: null,
      draggedPlanet: null
    }
  },

  _onCameraRef(ref) {
    this._cameraFacade = ref
  },

  _onPlanetMouseOver(e) {
    this.setState({hoveredPlanet: e.target.id})
  },

  _onPlanetMouseOut() {
    this.setState({hoveredPlanet: null})
  },

  _onPlanetDragStart(e) {
    this.setState({draggedPlanet: e.target.id})
  },

  _onPlanetDrag(e) {
    // Determine event's point on the orbital plane
    let systemTransformMatrix = new Matrix4().makeRotationX(ORBITAL_PLANE_ROTATEX)
    let systemPlane = new Plane().setComponents(0, 0, 1, 0).applyMatrix4(systemTransformMatrix)
    let mainRect = ReactDOM.findDOMNode(this).getBoundingClientRect()
    let mouseCoords = new Vector2(
      (e.clientX - mainRect.left) / mainRect.width * 2 - 1,
      (e.clientY - mainRect.top) / mainRect.height * -2 + 1
    )
    let raycaster = new Raycaster()
    raycaster.setFromCamera(mouseCoords, this._cameraFacade.threeObject)
    let posVec3 = raycaster.ray.intersectPlane(systemPlane)
    posVec3.applyMatrix4(new Matrix4().getInverse(systemTransformMatrix))

    // Update dragged planet's current angle and distance
    let planetData = find(this.state.planets, {id: e.target.id})
    planetData.initialAngle = posVec3.x === 0 ? 0 : Math.atan(posVec3.y / posVec3.x) + (posVec3.x < 0 ? Math.PI : 0)
    planetData.distance = Math.sqrt(posVec3.x * posVec3.x + posVec3.y * posVec3.y)
    this.forceUpdate()
  },

  _onPlanetDragEnd(e) {
    this.setState({
      draggedPlanet: null,
      droppablePlanet: null
    })
  },

  _onPlanetDragEnter(e) {
    this.setState({droppablePlanet: e.target.id})
  },
  
  _onPlanetDragLeave(e) {
    this.setState({droppablePlanet: null})
  },

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
  },

  render() {
    let state = this.state
    let {width, height} = this.props

    return (
      <div>
        <style type="text/css">@import url("dragdrop/styles.css")</style>

        <Canvas3D
          antialias
          width={ width }
          height={ height }
          className={ state.draggedPlanet ? 'dragging' : state.hoveredPlanet ? 'draggable' : null }
          lights={ [
            { type: 'ambient', color: 0x666666 },
            { type: 'point', color: 0xffffff }
          ] }
          camera={ {
            z: 400,
            ref: this._onCameraRef
          } }
          objects={ {
            key: 'system',
            class: Group,
            rotateX: ORBITAL_PLANE_ROTATEX,
            children: state.planets.map((planet, i) => {
              let isDraggedPlanet = state.draggedPlanet === planet.id
              let isDroppablePlanet = state.droppablePlanet === planet.id
              let isHoveredPlanet = state.hoveredPlanet === planet.id
              
              return {
                key: planet.id,
                class: Group,

                rotateZ: planet.initialAngle,

                animation: isDraggedPlanet ? [] : {
                  from: {rotateZ: planet.initialAngle},
                  to: {rotateZ: planet.initialAngle + Math.PI * 2},
                  duration: 20 * Math.sqrt(Math.pow(planet.distance, 3)), //very basic, probably incorrect, orbital period
                  iterations: Infinity,
                  paused: isHoveredPlanet || isDroppablePlanet
                },

                children: [
                  {
                    key: 'planet',
                    class: Planet,
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
                    class: Orbit,
                    distance: planet.distance
                  }
                ]
              }
            }).concat({
              key: 'sun',
              class: Sun,
              radius: 1,
              distance: 0,
              color: 0xffffff,
              highlight: true
            })
          } }
        />

        <div className="example_desc">
          <p>This example demonstrates use of drag-and-drop events. Drag planets to different orbits, or merge them by dropping on one another.</p>
        </div>

        <div className="example_controls">
        </div>
      </div>
    )
  }
})

