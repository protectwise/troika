import React from 'react'
import { Canvas3D, Group3DFacade } from 'troika-3d'
import { UIBlock3DFacade as Block } from 'troika-3d-ui'
import { paleBlueDot } from './texts'
import ColorCubes from './ColorCubes'
import FlexboxGlobe from './FlexboxGlobe'
import FlexboxLineGraph from './FlexboxLineGraph'
import { default as Icon } from './MaterialIconFacade'
import { Color, MeshStandardMaterial, TextureLoader, Vector3, Quaternion, Euler } from 'three'


const INIT_ORIGIN = {
  x: 0,
  y: 0,
  z: 0,
  rotateY: 0
}

const TABS = [
  {
    key: 'colors',
    title: 'Colorz',
    desc: 'Select a color from the cubes to show its value.'
  },
  {
    key: 'globe',
    title: 'Globez',
    desc: paleBlueDot
  },
  {
    key: 'graph',
    title: 'Graphz',
    desc: 'Line graphs stacked in the depth dimension'
  }
]

const GLOBE_TEXTURES = [
  {
    title: 'Day',
    url: 'globe/texture_day.jpg'
  },
  {
    title: 'Night',
    url: 'globe/texture_night.jpg'
  },
  {
    title: 'Blue Marble',
    url: 'globe/texture_bluemarble.jpg'
  },
  {
    title: 'Pumpkin',
    url: 'globe/texture_pumpkin.jpg'
  }
]



const GRAPH_COLORS = [0x996600, 0x009966, 0x006699, 0x669900, 0x660099]
const GRAPH_POINTS = 36

const globeAnim = [
  {
    from: {scale: 0.001},
    to: {scale: 1},
    easing: 'easeOutExpo'
  },
  {
    from: {rotateY: 0},
    to: {rotateY: Math.PI * 2},
    duration: 20000,
    iterations: Infinity
  }
]

const mainStageAngle = -Math.PI / 2.2

const backdropMaterial = new MeshStandardMaterial({roughness: 0.6, metalness: 0.8})

const texLoader = new TextureLoader()

function loadTextures() {
  GLOBE_TEXTURES.forEach(d => {
    if (!d.texture) {
      d.texture = texLoader.load(d.url)
    }
  })
}




class UIExample extends React.Component {
  constructor(props) {
    super(props)

    loadTextures()

    this.state = {
      tab: 'colors',
      globeTexture: GLOBE_TEXTURES[0],
      cameraVrOrigin: INIT_ORIGIN
    }

    this._onTabClick = e => {
      this.setState({
        tab: e.target.id,
        selectedColor: null
      })
    }
    this._onSelectColor = selectedColor => {
      this.setState({selectedColor})
    }
    this._onSelectGlobeTexture = globeTexture => {
      this.setState({globeTexture})
    }
    this._randomizeGraphData = () => {
      this.setState({
        graphData: GRAPH_COLORS.map(color => {
          const values = []
          for (let i = GRAPH_POINTS; i--;) {
            values[i] = Math.random() * 10 + 5
          }
          return {color, values}
        })
      })
    }
    this._onRecenterViewClick = e => {
      const matrix = e.target.getCameraFacade().threeObject.matrixWorld
      const pos = new Vector3()
      const quat = new Quaternion()
      const euler = new Euler()
      matrix.decompose(pos, quat, new Vector3())
      euler.setFromQuaternion(quat)
      this.setState({
        cameraVrOrigin: {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          rotateY: euler.y
        }
      })
    }
  }

  componentDidMount() {
    this._randomizeGraphData()
  }

  render() {
    const {props, state} = this
    const vr = props.vr
    const rootTransform = vr ? state.cameraVrOrigin : INIT_ORIGIN
    const tab = TABS.find(d => d.key === state.tab)

    return <div>
      <Canvas3D
        antialias
        backgroundColor={0}
        stats={ props.stats }
        width={ props.width }
        height={ props.height }
        camera={ {
          z: vr ? 0 : 0.5
        } }
        lights={[
          {type: 'point', x: 1},
          {type: 'point', x: -1}
        ]}
        objects={[
          Object.assign({}, rootTransform, {
            key: 'root',
            facade: Group3DFacade,
            children: [
              <Block
                key="uiRoot"
                flexDirection="column"
                alignItems="center"
                fontSize={20}
                width={1280}
                scale={1 / 640} //640 units within ui = 1 meter
                x={-1}
                y={0.3}
                z={-1.6}
              >
                <Block
                  key="topRow"
                  height={320}
                  flexDirection="row"
                >
                  <Block
                    key="titleAndDesc"
                    backgroundMaterial={backdropMaterial}
                    backgroundColor={0x333333}
                    flexDirection="column"
                    alignItems="stretch"
                    width={320}
                    rotateY={Math.PI / 8}
                    z={320 * Math.sin(Math.PI / 8)}
                    left={320 - 320 * Math.cos(Math.PI / 8)}
                  >
                    <Block
                      backgroundMaterial={backdropMaterial}
                      backgroundColor={0x444444}
                      fontSize={30}
                      padding={[10, 20]}
                    >{tab.title}</Block>
                    <Block padding={20} flex={1} overflow="scroll">
                      {tab.desc}
                    </Block>
                  </Block>

                  <Block
                    key="backdrop"
                    width={640}
                    backgroundMaterial={backdropMaterial}
                    backgroundColor={0x333333}
                  />

                  <Block
                    key="options"
                    backgroundMaterial={backdropMaterial}
                    backgroundColor={0x333333}
                    flexDirection="column"
                    width={320}
                    rotateY={-Math.PI / 8}
                    padding={20}
                  >
                    {
                      tab.key === 'colors' ? (
                        state.selectedColor == null ? null : [
                          <Block key="title"
                            margin={[20, 0]}
                          >Selected Color:</Block>,
                          <Block key="info"
                            flex={1}
                            flexDirection="row"
                            alignItems="center"
                          >
                            <Block
                              key="swatch"
                              width={64}
                              height={64}
                              backgroundColor={state.selectedColor}
                              borderWidth={2}
                              borderColor={0xffffff}
                              margin={[0, 10, 0, 0]}
                              z={50}
                            />
                            <Block fontSize={30}>{'#' + new Color(state.selectedColor).getHexString()}</Block>
                          </Block>,
                          buttonDef({
                            key: 'back',
                            onClick: this._onSelectColor.bind(this, null),
                            margin: [10, 5],
                            alignSelf: "flex-start",
                            fontSize: 24,
                            icon: 'arrow_back',
                            text: 'Back'
                          })
                        ]
                      ) : tab.key === 'globe' ? (
                        [
                          <Block key="title"
                            margin={[20, 0]}
                          >Choose a Texture:</Block>
                        ].concat(GLOBE_TEXTURES.map((d, i) =>
                          <Block
                            key={i}
                            flexDirection="row"
                            alignItems="center"
                            padding={[4, 0]}
                            color={0xffffff}
                            pointerStates={{hover: {color: 0x00ccff}}}
                            onClick={this._onSelectGlobeTexture.bind(this, d)}
                          >
                            <Icon icon={'radio_button_' + (d === state.globeTexture ? 'checked' : 'unchecked')} /> {d.title}
                          </Block>
                        ))
                      ) : tab.key === 'graph' ? (
                        buttonDef({
                          onClick: this._randomizeGraphData,
                          fontSize: 24,
                          text: 'Randomize Data'
                        })
                      ) : ''
                    }
                  </Block>

                </Block>

                <Block
                  key="mainStage"
                  width={640}
                  height={640}
                  rotateX={mainStageAngle}
                  borderWidth={3}
                  borderColor={0x999999}
                  borderRadius={[0, 0, 10, 10]}
                >
                  {/*<Block
                    key={tab.key}
                    flex={1}
                    animation={stageEnterAnim}
                    exitAnimation={stageExitAnim}
                  >*/}
                    {
                      tab.key === 'colors' ? (
                        <ColorCubes
                          flex={1}
                          margin={180}
                          z={120}
                          selectedColor={state.selectedColor}
                          onSelectColor={this._onSelectColor}
                          animation={{
                            from: {scale: 0.001},
                            to: {scale: 1},
                            easing: 'easeOutExpo'
                          }}
                        />
                      ) : tab.key === 'globe' ? (
                        <FlexboxGlobe
                          flex={1}
                          margin={150}
                          z={120}
                          rotateX={-mainStageAngle}
                          scaleX={1}
                          scaleZ={1}
                          scaleY={state.globeTexture.url.indexOf('pumpkin') > -1 ? 0.6 : 1}
                          texture={state.globeTexture.texture}
                          animation={globeAnim}
                          transition={{scaleY: true, scaleX: true, scaleZ: true}}
                        />
                      ) : tab.key === 'graph' ? (
                        state.graphData.map((d, i, all) =>
                          <FlexboxLineGraph
                            key={i}
                            flex={1}
                            margin={[10, 0]}
                            color={d.color}
                            values={d.values}
                            animation={{
                              from: {rotateX: 0, z: 0},
                              to: {rotateX: -mainStageAngle, z: (all.length - i - 1) * 20},
                              duration: 750,
                              delay: (all.length - i - 1) * 100,
                              easing: 'easeOutExpo'
                            }}
                          />
                        )
                      ) : ''
                    }
                  {/*</Block>*/}
                </Block>

                <Block
                  key="tabs"
                  flexDirection="row"
                  justifyContent="center"
                  width={640}
                  z={-Math.sin(mainStageAngle) * 640}
                  top={-640 + 640 * Math.cos(mainStageAngle)}
                  rotateX={-Math.PI / 4}
                >
                  {
                    TABS.map(d => {
                      const active = state.tab === d.key
                      return buttonDef({
                        key: d.key,
                        id: d.key,
                        onClick: this._onTabClick,
                        margin: [10, 5],
                        fontSize: 15,
                        backgroundColor: active ? 0x00ccff : 0x666666,
                        pointerEvents: !active,
                        z: active ? 10 : 0,
                        text: d.title
                      })
                    })
                  }
                </Block>

                {vr ? buttonDef({
                  onClick: this._onRecenterViewClick,
                  icon: 'sync',
                  text: 'Recenter View',
                  alignSelf: 'center',
                  backgroundColor: 0,
                  color: 0x333333,
                  fontSize: 24,
                  rotateX: -Math.PI / 4,
                  pointerStates: {
                    hover: {
                      backgroundColor: 0x666666,
                      color: 0xffffff
                    }
                  }
                }) : null}
              </Block>
            ]
          })
        ]}
      />
    </div>
  }
}


function buttonDef(props) {
  return Object.assign({
    facade: Block,
    padding: [5, 10],
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center',
    backgroundColor: 0x00ccff,
    pointerStates: {
      hover: {
        backgroundColor: 0x0099cc
      }
    },
    transition: {
      z: true,
      color: {interpolate: 'color'},
      backgroundColor: {interpolate: 'color'}
    },
    children: [
      props.icon ? <Icon icon={props.icon} /> : null,
      props.text
    ]
  }, props, {text: null, icon: null})
}


export default UIExample
