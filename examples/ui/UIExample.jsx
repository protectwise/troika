import React from 'react'
import T from 'prop-types'
import {Canvas3D, UIBlock3DFacade, Group3DFacade, UIImage3DFacade, ListFacade} from '../../src/index'
import { MeshStandardMaterial } from 'three'
import FlexboxGlobe from './FlexboxGlobe'
import CubeOfCubes from './CubeOfCubes'
import FlexboxLineGraph from './FlexboxLineGraph'

const mainPanelMaterial = new MeshStandardMaterial({roughness: 0.6, metalness: 0.7})
const FONT_URL = 'https://fonts.gstatic.com/s/quicksand/v7/6xKtdSZaM9iE8KbpRA_hK1QL.woff'

class UIExample extends React.Component {
  constructor(props) {
    super(props)
    this.toggleWireframe = this.toggleWireframe.bind(this)
    this.state = {
      wireframe: true,
      leftText: 'The quick brown fox was quick and brown.'
    }
  }

  toggleWireframe() {
    this.setState({wireframe: !this.state.wireframe})
  }

  render() {
    let state = this.state
    let {width, height, vr} = this.props

    return (
      <div>
        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={ width }
          height={ height }
          camera={ {
            y: vr ? 0.25 : 0,
            lookAt: vr ? null : {x: 0, y: 0, z:-1},
            animation: vr ? null : {
              from: {x: -0.1},
              to: {x: 0.1},
              duration: 5000,
              direction: 'alternate',
              iterations: Infinity
            }
          } }
          lights={[
            {type: 'point', x: 1},
            {type: 'point', x: -1}
          ]}
          objects={ {
            key: 'main',
            facade: Group3DFacade,
            z: -0.8,
            scaleX: 0.5 / 1024,
            scaleY: 0.5 / 1024,
            scaleZ: 0.5 / 1024,
            children: [
              {
                key: 'leftPane',
                facade: UIBlock3DFacade,
                x: -512 - 20 + Math.cos(Math.PI * -1.25) * 512,
                y: 512,
                z: Math.sin(Math.PI * -1.25) * 512,
                width: 512,
                height: 1024,
                rotateY: Math.PI / 4,
                backgroundColor: 0x333333,
                backgroundMaterial: mainPanelMaterial,
                padding: 20,
                font: FONT_URL,
                fontSize: 24,
                justifyContent: 'space-between',
                children: [
                  {
                    key: 'text1',
                    facade: UIBlock3DFacade,
                    text: (state.leftText || ''),
                    borderColor: 0x999999,
                    borderWidth: 1,
                    padding: 20,
                    borderRadius: 20,
                    minHeight: 0,
                    flexShrink: 1
                  },
                  {
                    key: 'img',
                    facade: UIImage3DFacade,
                    src: 'https://www.protectwise.com/images/social-share.png'
                  },
                  // {
                  //   key: 'inception',
                  //   facade: UICanvas3DFacade,
                  //   flex: 1,
                  //   textureWorld: {
                  //     facade: World2DFacade,
                  //     width: 1024,
                  //     height: 1024,
                  //     backgroundColor: '#333',
                  //     objects: [
                  //       {
                  //         key: 'scene',
                  //         facade: TwoDeeScene
                  //       }
                  //     ]
                  //   }
                  // },
                  {
                    key: 'button1',
                    facade: UIBlock3DFacade,
                    backgroundColor: 0x333399,
                    borderColor: 0xffffff,
                    borderWidth: 3,
                    padding: [10, 20],
                    fontSize: 32,
                    borderRadius: 10,
                    //z: 20,
                    text: 'Button',
                    onClick: e => {
                      this.setState({leftText: (state.leftText || '') + ' The quick brown fox was quick and brown.'})
                    }
                  }
                ]
                //justifyContent: 'center'
              },
              {
                key: 'centerPane',
                facade: UIBlock3DFacade,
                x: -512,
                y: 512,
                width: 1024,
                height: 1024,
                borderWidth: 5,
                borderColor: 0x333333,
                borderMaterial: mainPanelMaterial,
                fontSize: 40,
                justifyContent: 'space-between',
                children: [
                  {
                    key: 'top',
                    facade: UIBlock3DFacade,
                    flexDirection: 'row',
                    minHeight: '50%',
                    children: [
                      {
                        key: 'earthCt',
                        facade: UIBlock3DFacade,
                        flex: 1,
                        padding: 50,
                        margin: 20,
                        borderColor: 0x666666,
                        borderWidth: 2,
                        borderRadius: 10,
                        flexDirection: 'row',
                        children: {
                          key: 'earth',
                          facade: FlexboxGlobe,
                          flex: 1,
                          alignSelf: 'stretch',
                          animation: {
                            from: {rotateY: -Math.PI},
                            to: {rotateY: Math.PI},
                            duration: 24000,
                            iterations: Infinity
                          }
                        }
                      },
                      {
                        key: 'cubeCt',
                        facade: UIBlock3DFacade,
                        flex: 1,
                        padding: 50,
                        margin: 20,
                        borderColor: 0x666666,
                        borderWidth: 2,
                        borderRadius: 10,
                        children: {
                          key: 'cube',
                          facade: CubeOfCubes,
                          flex: 1,
                          alignSelf: 'stretch',
                          onCubeOver: e => {
                            this.setState({isHoveringCube: true})
                            clearTimeout(this._cubeOutTimer)
                          },
                          onCubeOut: e => {
                            clearTimeout(this._cubeOutTimer)
                            this._cubeOutTimer = setTimeout(() => {
                              this.setState({isHoveringCube: false})
                            }, 500)
                          },
                          animation: {
                            from: {rotateX: -Math.PI, rotateY: -Math.PI, rotateZ: -Math.PI},
                            to: {rotateX: Math.PI, rotateY: Math.PI, rotateZ: Math.PI},
                            duration: 10000,
                            iterations: Infinity,
                            paused: this.state.isHoveringCube
                          }
                        }
                      }
                    ]
                  },
                  {
                    key: 'bottom',
                    facade: UIBlock3DFacade,
                    flex: 1,
                    backgroundColor: 0x333333,
                    backgroundMaterial: mainPanelMaterial,
                    children: [
                      {
                        key: 'graph1',
                        facade: FlexboxLineGraph,
                        flex: 1,
                        z: 0,
                        position: 'absolute',
                        top: 100,
                        left: 0,
                        right: 0,
                        bottom: 100,
                        color: 0x996600
                      },
                      {
                        key: 'graph2',
                        facade: FlexboxLineGraph,
                        flex: 1,
                        z: 20,
                        position: 'absolute',
                        top: 150,
                        left: 0,
                        right: 0,
                        bottom: 50,
                        color: 0x006699
                      },
                      {
                        key: 'graph3',
                        facade: FlexboxLineGraph,
                        flex: 1,
                        z: 40,
                        position: 'absolute',
                        top: 200,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        color: 0x009966
                      }
                    ]
                  }
                ]
              },
              {
                key: 'rightPane',
                facade: UIBlock3DFacade,
                x: 512 + 20,
                y: 512,
                width: 512,
                // animation: {
                //   from: {width: 512},
                //   to: {width: 768},
                //   duration: 2000,
                //   direction: 'alternate',
                //   iterations: Infinity
                // },
                height: 1024,
                rotateY: Math.PI / -4,
                backgroundColor: 0x333333,
                backgroundMaterial: mainPanelMaterial,
                padding: 10,
                fontSize: 24,
                font: FONT_URL,
                justifyContent: 'space-around',
                children: [
                  {
                    key: 'top',
                    facade: UIBlock3DFacade,
                    backgroundColor: 0x222222,
                    margin: 10,
                    padding: 10,
                    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
                  },
                  {
                    key: 'mid',
                    facade: UIBlock3DFacade,
                    text: 'Center',
                    alignSelf: 'center',
                    backgroundColor: 0x666666,
                    color: 0,
                    padding: 20,
                    borderRadius: 20
                  },
                  {
                    key: 'bottom',
                    facade: UIBlock3DFacade,
                    backgroundColor: 0x222222,
                    margin: 10,
                    padding: 10,
                    // animation: {
                    //   from: {scrollTop: 0},
                    //   to: {scrollTop: 100},
                    //   duration: 3000,
                    //   direction: 'alternate',
                    //   iterations: Infinity
                    // },
                    minHeight: 0,
                    flexShrink: 1,
                    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
                  }
                ]
              }
            ]
          } }
        />

        <div className="example_desc">

        </div>

        <div className="example_controls">
        </div>
      </div>
    )
  }
}

UIExample.propTypes = {
  width: T.number,
  height: T.number
}

export default UIExample
