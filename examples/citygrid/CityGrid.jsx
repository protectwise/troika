import random from 'lodash/random'
import sample from 'lodash/sample'
import clone from 'lodash/clone'
import React from 'react'
import {hierarchy, treemap, treemapResquarify} from 'd3-hierarchy'
import {Canvas3D, Group, List} from '../../src/index'
import Ground from './Ground'
import Host from './Host'
import Zone from './Zone'
import Camera from './Camera'

const CAMERA_UP = {x: 0, y: 0, z: 1}
const DROPAWAY_Z = -100

const randomThreatLevel = () => random(0, 20) ? null : sample(['Low', 'Medium', 'High'])
const randomZoneHeight = () => random(1, 10)
const randomHostHeight = () => Math.max(1, random(-10, 20))


const CityGrid = React.createClass({
  displayName: 'CityGrid',

  propTypes: {
    width: React.PropTypes.number,
    height: React.PropTypes.number
  },

  getInitialState() {
    return {
      isLoading: true,
      data: null,
      cameraElevation: 50,
      cameraDistance: 100,
      cameraAngle: 0,
      cameraLookAt: {x:0, y:0, z:0},
      rotatingCamera: false,
      enableTransitions: true,
      showZoneLabels: false,
      hoveredHostIp: null,
      selectedHostIp: null
    }
  },

  componentWillMount() {
    this._generateData()
  },

  componentWillUnmount() {
    cancelAnimationFrame(this._cameraRotateRAF)
  },

  _generateData() {
    // Mockery
    let data = {children: []}
    for (let zone = 0; zone < 20; zone++) {
      let hostCount = random(10, 500)
      let zoneData = {
        children: [],
        value: hostCount,
        height: randomZoneHeight()
      }
      for (let host = 0; host < hostCount; host++) {
        zoneData.children.push({
          value: 1,
          height: randomHostHeight(),
          threatLevel: randomThreatLevel(),
          ip: `${random(1,255)}.${random(1,255)}.${random(1,255)}.${random(1,255)}`
        })
      }
      data.children.push(zoneData)
    }

    let layoutSideLength
    let zoneHierarchy = hierarchy(data).sum(d => d.value)
    layoutSideLength = Math.sqrt(zoneHierarchy.leaves().length) * 3
    let layout = this._treemapLayout || (this._treemapLayout = treemap().padding(2).tile(treemapResquarify))
    layout.size([layoutSideLength, layoutSideLength])
    layout(zoneHierarchy)

    this._hostsChanged = true
    this.setState({
      data: data,
      layoutSideLength,
      center: [layoutSideLength / 2, layoutSideLength / 2],
      hierarchy: zoneHierarchy,
      isLoading: false
    })
    console.log(`Generated ${zoneHierarchy.children.length} zones with ${zoneHierarchy.leaves().length} hosts`)
  },

  _changeHeights() {
    let data = clone(this.state.data)
    data.children.forEach(z => {
      z.height = random(1, 10)
      z.children.forEach(h => {
        h.height = randomHostHeight()
      })
    })
    this._hostsChanged = true
    this.setState({data})
  },

  _changeThreatLevels() {
    let data = clone(this.state.data)
    data.children.forEach(z => {
      z.children.forEach(h => {
        h.threatLevel = randomThreatLevel()
      })
    })
    this._hostsChanged = true
    this.setState({data})
  },

  _onMouseWheel(e) {
    let {shiftKey, deltaY} = e.nativeEvent
    e.preventDefault()
    this._isWheeling = true
    let after = () => {
      this._isWheeling = false
    }
    if (shiftKey) {
      this.setState({cameraElevation: Math.max(1, this.state.cameraElevation + deltaY / 10)}, after)
    } else {
      this.setState({cameraDistance: Math.max(1, this.state.cameraDistance + deltaY / 5)}, after)
    }
  },

  _gotoRandomCameraPos() {
    this.setState({
      cameraElevation: random(1, 200),
      cameraDistance: random(1, 200),
      cameraAngle: this.state.cameraAngle + random(-Math.PI / 2, Math.PI / 2)
    })
  },

  _toggleRotation() {
    let rotating = this.state.rotatingCamera
    rotating = !rotating ? 'state' : rotating === 'state' ? 'animation' : null
    this._lastRotationTime = null
    this.setState({rotatingCamera: rotating}, this._tickCameraRotation)
  },

  _toggleTransitions() {
    this.setState({enableTransitions: !this.state.enableTransitions})
  },

  _toggleZoneLabels() {
    this.setState({showZoneLabels: !this.state.showZoneLabels})
  },

  _tickCameraRotation() {
    if (this.state.rotatingCamera === 'state') {
      let now = Date.now()
      if (this._lastRotationTime) {
        let dur = now - this._lastRotationTime
        this.setState({cameraAngle: this.state.cameraAngle + (Math.PI * 2 * (dur / 30000))}) // 30s around
      }
      this._lastRotationTime = now
      this._cameraRotateRAF = requestAnimationFrame(this._tickCameraRotation)
    }
  },


  _onHostMouseOver(e) {
    this._hostsChanged = true
    this.setState({hoveredHostIp: e.target.ip})
  },

  _onHostMouseOut(e) {
    this._hostsChanged = true
    this.setState({hoveredHostIp: null})
  },

  _onHostClick(e) {
    this._hostsChanged = true
    this.setState({selectedHostIp: e.target.ip})
  },

  _onSceneClick(e) {
    this._hostsChanged = true
    this.setState({selectedHostIp: null})
  },



  render() {
    let {props, state} = this
    let zoneHierarchy = state.hierarchy
    let hostsChanged = this._hostsChanged
    this._hostsChanged = false

    return (
      <div className="the_grid" onWheel={ this._onMouseWheel }>
        <div className="example_controls">
          <button onClick={ this._changeHeights }>Change Heights</button>
          <button onClick={ this._changeThreatLevels }>Change Threats</button>
          <button onClick={ this._generateData }>Regen Full</button>
          <button onClick={ this._gotoRandomCameraPos }>Random Camera Pos</button>
          <button onClick={ this._toggleRotation }>Rotate: { state.rotatingCamera || 'off' }</button>
          <button onClick={ this._toggleTransitions }>Transitions: { state.enableTransitions ? 'on' : 'off' }</button>
          <button onClick={ this._toggleZoneLabels }>Zone Labels: { state.showZoneLabels ? 'on' : 'off' }</button>
        </div>

        { state.data ? (
          <Canvas3D
            width={ props.width }
            height={ props.height }
            antialias
            backgroundColor={ 0x222222 }
            lights={ [
              {
                type: 'ambient',
                color: 0xffffff,
                intensity: 0.8
              },
              {
                type: 'point',
                x: 0,
                y: 0,
                z: 200,
                color: 0xffffff,
                intensity: 1
              }
            ] }
            camera={ {
              class: Camera,
              aspect: props.width / props.height,
              elevation: state.cameraElevation,
              angle: state.cameraAngle,
              distance: state.cameraDistance,
              lookAt: state.cameraLookAt,
              up: CAMERA_UP,
              transition: state.enableTransitions && !this._isWheeling ? {
                angle: !state.rotatingCamera,
                distance: 1,
                elevation: 1
              } : null,
              animation: state.rotatingCamera === 'animation' ? {
                0: {angle: state.cameraAngle},
                100: {angle: state.cameraAngle + Math.PI * 2},
                duration: 30000,
                iterations: Infinity
              } : null
            } }
            fog={ {
              color: 0x222222,
              density: 0.003,
            } }
            objects={ [
              {
                key: 'main',
                class: Group,
                x: -state.center[0],
                y: -state.center[1],
                z: 0,
                children: [
                  {
                    key: 'ground',
                    class: Ground,
                    width: state.layoutSideLength,
                    height: state.layoutSideLength,
                    z: state.selectedHostIp ? DROPAWAY_Z : 0,
                    transition: state.enableTransitions && {
                      width: true,
                      height: true,
                      z: {delay: state.selectedHostIp ? 0 : 1000}
                    }
                  },
                  {
                    key: 'hosts',
                    class: List,
                    data: zoneHierarchy.leaves(),
                    shouldUpdateChildren: () => hostsChanged,
                    template: {
                      key: (host, i) => `host${ i }`,
                      class: Host,
                      ip: (host) => host.data.ip,
                      x: host => host.x0,
                      y: host => host.y0,
                      z: state.selectedHostIp ? (host => host.data.ip === state.selectedHostIp ? 0 : DROPAWAY_Z) : 0,
                      rotateZ: 0,
                      height: host => host.data.height,
                      threatLevel: host => host.data.threatLevel,
                      transition: state.enableTransitions ? (host, i, arr) => {
                        let tx = {
                          delay: host.data.ip === state.selectedHostIp ? 0 : Math.round(1000 * i / arr.length)
                        }
                        return {
                          x: tx,
                          y: tx,
                          z: tx,
                          height: tx,
                          rotateZ: true
                        }
                      } : null,
                      animation: host => host.data.ip === state.hoveredHostIp ? [
                        {
                          0: {rotateZ: 0},
                          100: {rotateZ: Math.PI / 2},
                          duration: 500,
                          iterations: Infinity
                        },
                        {
                          0: {height: host.data.height},
                          50: {height: host.data.height + 1},
                          100: {height: host.data.height},
                          duration: 1000,
                          delay: 1000,
                          easing: 'easeOutBounce',
                          iterations: Infinity
                        }
                      ] : null,
                      highlight: (host) => host.data.ip === state.hoveredHostIp,
                      onMouseOver: () => this._onHostMouseOver,
                      onMouseOut: () => this._onHostMouseOut,
                      onClick: () => this._onHostClick
                    }
                  },
                  {
                    key: 'zones',
                    class: List,
                    data: zoneHierarchy.children,
                    template: {
                      key: (zone, i) => `zone${ i }`,
                      class: Zone,
                      x: zone => zone.x0,
                      y: zone => zone.y0,
                      z: zone => state.selectedHostIp ? DROPAWAY_Z : 0,
                      width: zone => zone.x1 - zone.x0,
                      length: zone => zone.y1 - zone.y0,
                      height: zone => zone.data.height,
                      label: state.showZoneLabels ? (zone, i) => `Zone ${i}` : null,
                      transition: state.enableTransitions ? (zone, i, arr) => {
                        let tx = {
                          delay: Math.round(1000 * i / arr.length)
                        }
                        return {
                          x: tx,
                          y: tx,
                          z: tx,
                          width: tx,
                          length: tx,
                          height: tx
                        }
                      } : null
                    }
                  }
                ]
              }
            ] }
            onBackgroundClick={ this._onSceneClick }
          />
        ) : null }
      </div>
    )
  }
})




export default CityGrid
