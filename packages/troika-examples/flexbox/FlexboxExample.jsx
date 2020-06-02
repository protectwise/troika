import React from 'react'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'
import { Canvas3D, BoxFacade, Group3DFacade } from 'troika-3d'
import { Text3DFacade } from 'troika-3d-text'
import { UIBlock3DFacade as div } from 'troika-3d-ui'
import { Matrix4, Plane, Vector3, MeshStandardMaterial } from 'three'
import FlexboxGlobe from './FlexboxGlobe.js'

const tempPlane = new Plane()
const tempVec3 = new Vector3()
const tempMat4 = new Matrix4()
const bgMaterial = new MeshStandardMaterial({roughness: 0.6, metalness: 0.8, color: 0x333333})

const TEXT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'

const textCellConfig = {
  facade: div,
  text: TEXT,
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 1,
  padding: 0.02,
  backgroundColor: 0x444444,
  margin: [0, 0.02, 0, 0],
  overflow: 'auto'
}

const globeCellConfig = {
  facade: FlexboxGlobe,
  width: '20%',
  padding: 0.02,
  margin: [0, 0.02, 0, 0],
  animation: {
    from: {rotateY: 0},
    to: {rotateY: Math.PI * 2},
    iterations: Infinity,
    duration: 6000
  }
}

const listCellConfig = {
  facade: div,
  overflow: 'scroll',
  children: (() => {
    let items = []
    for (let i = 0; i < 10; i++) {
      items.push({
        key: i,
        facade: div,
        borderWidth: 0.002,
        borderColor: 0xffffff,
        borderRadius: 0.01,
        margin: 0.01,
        padding: [0.005, 0.01],
        text: `List Item ${i + 1}`
      })
    }
    return items
  })()
}

const rowConfig = {
  facade: div,
  flexDirection: 'row',
  margin: [0, 0, 0.05],
  padding: [0.02, 0, 0.02, 0.02],
  borderRadius: 0.01,
  backgroundColor: 0x666666,
  flexGrow: 1,
  flexShrink: 1
}

const rows = [
  Object.assign({}, rowConfig, {children: [textCellConfig, globeCellConfig, textCellConfig]}),
  Object.assign({}, rowConfig, {children: [globeCellConfig, textCellConfig]}),
  Object.assign({}, rowConfig, {children: [textCellConfig, listCellConfig, globeCellConfig]}),
  Object.assign({}, rowConfig, {children: [globeCellConfig, listCellConfig, globeCellConfig, textCellConfig]})
]


export default class FlexboxExample extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      width: 2,
      height: 2,
      fontSize: 0.04
    }
    this._onDrag = e => {
      // Intersect ray on UI plane
      let {target, ray} = e
      let uiMatrix = target.parent.threeObject.matrixWorld
      let uiPlane = tempPlane.setComponents(0, 0, 1, 0).applyMatrix4(uiMatrix)
      let pos = ray.intersectPlane(uiPlane, tempVec3)
      if (pos) {
        pos.applyMatrix4(tempMat4.getInverse(uiMatrix))
        this.setState({
          width: Math.min(5, Math.max(0.5, target.isTopLeft ? this.state.width - pos.x : pos.x)),
          height: Math.min(5, Math.max(0.5, target.isTopLeft ? this.state.height + pos.y : -pos.y))
        })
      }
    }
    this._onConfigUpdate = (newState) => {
      this.setState(newState)
    }
  }

  render() {
    let {props, state} = this
    return <div>
      <Canvas3D
        antialias
        stats={ props.stats }
        width={ props.width }
        height={ props.height }
        camera={ {
          fov: 75,
          x: 0,
          y: 0,
          z: 2
        } }
        lights={[
          // {type: 'ambient', color: 0x666666},
          {
            type: 'point',
            z: 8,
            y: 1,
            x: 0,
            color: 0xccccff,
            animation: {
              from: {x: 10},
              to: {x: -10},
              iterations: Infinity,
              direction: 'alternate',
              easing: 'easeInOutSine',
              duration: 2000
            }
          }
        ]}
        objects={ [
          {
            key: 'root',
            facade: Group3DFacade,
            animation: {
              from: {rotateY: -Math.PI / 8},
              to: {rotateY: Math.PI / 8},
              duration: 10000,
              direction: 'alternate',
              iterations: Infinity
            },
            children: {
              key: 'ui',
              facade: div,
              width: state.width,
              height: state.height,
              fontSize: state.fontSize,
              color: 0xffffff,
              x: -state.width / 2,
              y: state.height / 2,
              backgroundMaterial: bgMaterial,
              padding: [0.05, 0.05, 0],
              borderRadius: 0.04,
              borderWidth: 0.005,
              borderColor: 0x999999,
              flexDirection: 'column',
              alignItems: 'stretch',
              children: [
                ...rows,
                {
                  key: 'dragger',
                  facade: BoxFacade,
                  width: 0.05,
                  height: 0.05,
                  depth: 0.02,
                  x: state.width,
                  y: -state.height,
                  z: 0.01,
                  'material.color': 0x66ff66,
                  onDragStart: this._onDrag,
                  onDrag: this._onDrag
                },
                {
                  key: 'dragLbl',
                  facade: Text3DFacade,
                  fontSize: 0.04,
                  anchorY: 'middle',
                  x: state.width + 0.05,
                  y: -state.height,
                  z: 0.02,
                  text: 'drag me'
                },
                {
                  key: 'draggerTL',
                  facade: BoxFacade,
                  width: 0.05,
                  height: 0.05,
                  depth: 0.02,
                  x: 0,
                  y: 0,
                  z: 0.01,
                  'material.color': 0x66ff66,
                  isTopLeft: true,
                  onDragStart: this._onDrag,
                  onDrag: this._onDrag
                },
                {
                  key: 'dragLblTL',
                  facade: Text3DFacade,
                  fontSize: 0.04,
                  anchorY: 'middle',
                  anchorX: 'right',
                  x: -0.05,
                  y: 0,
                  z: 0.02,
                  text: 'drag me'
                }
              ]
            }
          },
          {
            key: 'config',
            isXR: !!this.props.vr,
            facade: ExampleConfigurator,
            data: state,
            onUpdate: this._onConfigUpdate,
            items: [
              {type: 'number', path: "fontSize", label: "fontSize", min: 0.01, max: 0.2, step: 0.01}
            ]
          }
        ] }
      />

      <div className="example_desc">
        <p>Demonstration of the flexbox layout capabilities of the <a href="https://github.com/protectwise/troika/tree/master/packages/troika-3d-ui">troika-3d-ui</a> package. Drag the green handles to resize it and see things reflow on the fly, with overflow scrolling.</p>
        <p>Behind the scenes this uses <a href="https://yogalayout.com/">Yoga</a> in conjunction with <a href="https://github.com/protectwise/troika/tree/master/packages/troika-3d-text">troika-3d-text</a> to calculate the flexbox layout for a tree of FlexNode facades. A UIBlock3DFacade is provided for 2D CSS-like backgrounds/borders with rounded corners, but any 3D object can be also extended as a FlexNode to participate in the layout. Layout is performed in a web worker to avoid frame drops.</p>
      </div>
    </div>
  }
}


