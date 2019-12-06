import React from 'react'
import { Canvas3D, Group3DFacade } from 'troika-3d'
import Bezier3DFacade from './Bezier3DFacade'
import ShadowSurface from './ShadowSurfaceFacade'
import DatGui, {DatBoolean, DatNumber} from 'react-dat-gui'


const pointProps = ["p1x", "p1y", "p1z", "c1x", "c1y", "c1z", "c2x", "c2y", "c2z", "p2x", "p2y", "p2z"]
const colors = []
const randomColor = () => Math.round(Math.random() * 0xffffff)

class Bezier3DExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      count: 4,
      radius: 0.01,
      dashed: 0,
      randomize: true,
      shadows: true,
      p1x: -1,
      p1y: 0,
      p1z: 0,
      c1x: 0,
      c1y: 0,
      c1z: 0,
      c2x: 0,
      c2y: 0,
      c2z: 0,
      p2x: 1,
      p2y: 0,
      p2z: 0
    }
  }

  render() {
    const {props, state} = this
    const vr = props.vr

    const beziers = []
    for (let i = 0; i < (state.randomize ? state.count : 1); i++) {
      const obj = {
        key: 'bezier' + i,
        facade: Bezier3DFacade,
        radius: state.radius,
        color: state.randomize ? (colors[i] || (colors[i] = randomColor())) : 0x66ccff,
        castShadow: state.shadows,
        dashArray: [state.dashed, state.dashed],
        animation: state.randomize ? getAnimation(i) : null
      }
      pointProps.forEach(prop => {
        obj[prop] = state[prop]
      })
      beziers.push(obj)
    }

    return <div>
      <Canvas3D
        antialias
        shadows={state.shadows}
        backgroundColor={0}
        stats={ props.stats }
        width={ props.width }
        height={ props.height }
        camera={ {
          z: vr ? 1 : 3
        } }
        lights={[
          {
            type: 'directional',
            z: 2,
            y: 1,
            castShadow: state.shadows,
            shadow: {
              //mapSize: {width: 1024, height: 1024},
              camera: {far: 10, near: 0.1, left: -2, right: 2, top: 2, bottom: -2}
            }
          },
        ]}
        objects={[
          {
            key: 'beziers',
            facade: Group3DFacade,
            children: beziers,
            animation: state.randomize ? {
              from: {rotateY: 0},
              to: {rotateY: Math.PI * 2},
              duration: 10000,
              iterations: Infinity
            } : null
          },
          state.shadows ? {
            key: 'plane',
            facade: ShadowSurface,
            receiveShadow: true,
            scale: 4,
            rotateX: Math.PI / -6,
            z: -3,
            y: -1
          } : null,
        ]}
      />

      <DatGui data={state} onUpdate={s => this.setState(s)}>
        <DatNumber path="radius" min={0.001} max={0.1} step={0.001} />
        <DatNumber path="dashed" min={0} max={0.2} step={0.01} />
        <DatBoolean path="shadows" />
        <DatBoolean path="randomize" />
        {state.randomize ? <DatNumber path="count" min={1} max={100} step={1} /> : null }

        {state.randomize ? null : pointProps.map(prop =>
          <DatNumber key={prop} path={prop} min={-1} max={1} step={0.01} />
        )}
      </DatGui>

      <div className="example_desc">
        <p>Tube shape following a 3D cubic bezier path. This uses a fixed cylinder geometry which is transformed by a custom vertex shader, given its control points as uniforms.</p>
      </div>
    </div>
  }
}


const animations = []
function getAnimation(index) {
  if (!animations[index]) {
    const makeKeyframe = () => {
      const kf = {}
      pointProps.forEach(prop => {
        kf[prop] = Math.random() * 2 - 1
      })
      return kf
    }
    const firstKeyframe = makeKeyframe()
    const anim = {
      0: firstKeyframe,
      100: firstKeyframe,
      duration: 20000,
      iterations: Infinity
    }
    for (let i = 0; i < 100; i += 10) {
      if (i > 0) {
        anim[i] = makeKeyframe()
      }
    }
    animations[index] = anim
  }
  return animations[index]
}



export default Bezier3DExample
