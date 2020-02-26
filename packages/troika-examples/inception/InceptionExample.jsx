import {BoxBufferGeometry, Mesh, MeshStandardMaterial, SphereBufferGeometry} from 'three'
import {World2DFacade} from 'troika-2d'
import {makeWorldTextureProvider, Object3DFacade, Canvas3D, World3DFacade} from 'troika-3d'
import {TwoDeeScene} from '../canvas2d/Canvas2DExample'
import React from 'react'
import ArcsFacade from '../arcs/ArcsFacade'
import {refreshArcsData} from '../arcs/arcsData'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'


const sphereGeom = new SphereBufferGeometry(0.5, 32, 32)
const boxGeom = new BoxBufferGeometry(1, 1, 1)

class WorldTexturedSphere extends Object3DFacade {
  constructor(parent, subWorldTexture) {
    super(parent, new Mesh(
      sphereGeom,
      new MeshStandardMaterial({
        map: subWorldTexture,
        roughness: 0.5,
        metalness: 0.5
      })
    ))
  }
}
WorldTexturedSphere = makeWorldTextureProvider(WorldTexturedSphere)

class WorldTexturedBox extends Object3DFacade {
  constructor(parent, subWorldTexture) {
    super(parent, new Mesh(
      boxGeom,
      new MeshStandardMaterial({
        map: subWorldTexture,
        roughness: 0.5,
        metalness: 0.5
      })
    ))
  }
}
WorldTexturedBox = makeWorldTextureProvider(WorldTexturedBox)


class AutoUpdatingArcsFacade extends ArcsFacade {
  constructor(parent) {
    super(parent)
    this.data = refreshArcsData(null)
    this._timer = setInterval(() => {
      this.data = refreshArcsData(this.data)
    }, 3000)
  }
  destructor() {
    clearInterval(this._timer)
    super.destructor()
  }
}

const subWorldConfig2D = {
  label: '2D',
  facade: World2DFacade,
  width: 1024,
  height: 1024,
  backgroundColor: '#333',
  objects: [
    {
      key: 'scene',
      facade: TwoDeeScene
    }
  ]
}
const subWorldConfig3D = {
  label: '3D',
  facade: World3DFacade,
  antialias: true,
  width: 1024,
  height: 1024,
  backgroundColor: '#333',
  camera: {
    x: 0,
    z: 6,
    lookAt: {x: 0, y: 0, z: 0}
  },
  objects: [
    {
      key: 'scene',
      facade: AutoUpdatingArcsFacade,
      angled: true,
      arcDepth: 0.2
    }
  ]
}
const subWorldRecursive = {
  label: 'Recursive',
  facade: World3DFacade,
  antialias: true,
  width: 1024,
  height: 1024,
  backgroundColor: '#333',
  camera: {
    x: 0,
    z: 4,
    lookAt: {x: 0, y: 0, z: 0}
  },
  lights: [
    { type: 'ambient', color: 0xffffff },
    { type: 'directional', color: 0xffffff, x: 1, y: 1, z: 1 }
  ],
  objects: [
    {
      key: '2d',
      facade: WorldTexturedSphere,
      x: -1,
      textureWorld: subWorldConfig2D,
      animation: {
        from: {rotateY: 0},
        to: {rotateY: Math.PI * 2},
        duration: 20000,
        iterations: Infinity
      }
    },
    {
      key: '3d',
      facade: WorldTexturedBox,
      x: 1,
      textureWorld: subWorldConfig2D,
      animation: {
        from: {rotateY: 0},
        to: {rotateY: Math.PI * 2},
        duration: 20000,
        iterations: Infinity
      }
    }
  ]
}
const subWorldConfigs = [
  subWorldConfig2D,
  subWorldConfig3D,
  subWorldRecursive
]


export default class InceptionExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      subWorldIndex: 0
    }
  }

  render() {
    let {width, height} = this.props

    return (
      <div>
        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={ width }
          height={ height }
          lights={ [
            { type: 'ambient', color: 0xffffff },
            { type: 'directional', color: 0xffffff, x: 1, y: 1, z: 1 }
          ] }
          camera={ {
            z: 3
          } }
          objects={ [
            {
              key: '2d',
              facade: WorldTexturedSphere,
              x: -1,
              textureWorld: subWorldConfigs[this.state.subWorldIndex],
              animation: {
                from: {rotateY: 0},
                to: {rotateY: Math.PI * 2},
                duration: 20000,
                iterations: Infinity
              }
            },
            {
              key: '3d',
              facade: WorldTexturedBox,
              x: 1,
              textureWorld: subWorldConfigs[this.state.subWorldIndex],
              animation: {
                from: {rotateY: 0},
                to: {rotateY: Math.PI * 2},
                duration: 20000,
                iterations: Infinity
              }
            },
            {
              key: 'config',
              isXR: !!this.props.vr,
              facade: ExampleConfigurator,
              data: this.state,
              onUpdate: this.setState.bind(this),
              items: [
                {type: 'select', path: 'subWorldIndex', label: 'Sub World Type',
                  options: subWorldConfigs.map((cfg, i) => {
                    return {value: i, label: cfg.label}
                  })
                }
              ]
            }
          ] }
        />

        <div className="example_desc">
          <p>This example demonstrates the <code>makeWorldTextureProvider()</code> higher-order facade decorator, which
          renders a Troika 2D or 3D sub-world into a <code>Texture</code> which can then be mapped onto a mesh.
          Pointer events are forwarded through to the sub-world so the texture's contents are fully interactive.</p>
        </div>

      </div>
    )
  }
}




