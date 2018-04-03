import React from 'react'
import T from 'prop-types'
import {
  Canvas3D,
  Group3DFacade,
  ListFacade,
  UIBlock3DFacade as Block,
  UIImage3DFacade as Img
} from '../../src/index'
import Icon from './MaterialIconFacade'
import { MeshStandardMaterial, MeshBasicMaterial, TextureLoader } from 'three'
import FlexboxGlobe from './FlexboxGlobe'
import CubeOfCubes from './CubeOfCubes'
import FlexboxLineGraph from './FlexboxLineGraph'
import Checkbox from './Checkbox'

const mainPanelMaterial = new MeshStandardMaterial({roughness: 0.6, metalness: 0.8})
const FONT_URL = 'https://fonts.gstatic.com/s/notosans/v7/o-0IIpQlx3QUlC5A4PNr5TRG.woff'
const FONT_URL_HEADER = 'https://fonts.gstatic.com/s/raleway/v12/1Ptrg8zYS_SKggPNwPIsWqZPBg.woff'
const constant = val => () => val

// reusable props for headers
const headerStyles = {
  font: FONT_URL_HEADER,
  fontSize: 32,
  backgroundColor: 0x444444,
  borderRadius: [10, 10, 0, 0],
  padding: [0, 20],
  lineHeight: 2
}


class UIExample extends React.Component {
  constructor(props) {
    super(props)
    this.toggleWireframe = this.toggleWireframe.bind(this)
    this.state = {
      wireframe: true,
      leftText: 'The quick brown fox was quick and brown.',
      lineGraphsLayered: true
    }
  }

  componentWillMount() {
    this.randomizeLineGraphs()
  }

  toggleWireframe() {
    this.setState({wireframe: !this.state.wireframe})
  }

  randomizeLineGraphs() {
    const state = {}
    ;[1, 2, 3].forEach(n => {
      const values = []
      for (let i = 50; i--; ) {
        values[i] = Math.random() * 10 + 5
      }
      state[`lineGraph${n}Values`] = values
    })
    this.setState(state)
  }

  showMessage(text) {
    this.setState({
      alertMessage: {
        id: Math.random(),
        text
      }
    })
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
            // animation: vr ? null : {
            //   from: {x: -0.1},
            //   to: {x: 0.1},
            //   duration: 5000,
            //   direction: 'alternate',
            //   iterations: Infinity
            // }
          } }
          lights={[
            {type: 'point', x: 1},
            {type: 'point', x: -1}
          ]}
          objects={
            <Group3DFacade
              key="root"
              z={-0.8}
              scale={0.5 / 1024}
            >
              <Block
                key='leftPane'
                x={-512 - 20 + Math.cos(Math.PI * -1.25) * 512}
                y={512}
                z={Math.sin(Math.PI * -1.25) * 512}
                width={512}
                height={1024}
                rotateY={Math.PI / 4}
                backgroundColor={0x333333}
                backgroundMaterial={mainPanelMaterial}
                padding={20}
                font={FONT_URL}
                fontSize={24}
                justifyContent='space-between'
              >
                <Block
                  borderColor={0x999999}
                  borderWidth={1}
                  padding={20}
                  borderRadius={20}
                  minHeight={0}
                  flexShrink={1}
                  // Computed flexbox layout properties are animatable just like any other!
                  transition={{offsetHeight: true, clientHeight: true}}
                >
                  {state.leftText || ''}
                </Block>

                {/*<Img src='https://www.protectwise.com/images/social-share.png' />*/}

                <Block children={[1, 2, 3].map(n => <Checkbox
                    key={`cb${n}`}
                    checked={this.state[`cb${n}Checked`]}
                    label={`Toggle #${n}`}
                    onClick={e => {
                      this.setState({[`cb${n}Checked`]: !state[`cb${n}Checked`]})
                    }}
                  />)
                } />

                {/*
                <Block
                  flexDirection="row"
                  children={[1, 2, 3].map(n => state[`cb${n}Checked`] ? <Block
                    key={n}
                    padding={20}
                    borderWidth={2}
                    borderColor={0x444444}
                    flex={1}
                    transition={{offsetLeft: true, offsetWidth: true}}
                  >{`Item #${n}`}</Block> : null)}
                />
                */}

                <Block
                  key="button1"
                  backgroundColor={0x333399}
                  pointerStates={{
                    hover:{backgroundColor: 0x4444aa},
                    active:{backgroundColor: 0x6666cc}
                  }}
                  borderColor={0xffffff}
                  borderWidth={3}
                  padding={[10, 20]}
                  fontSize={32}
                  borderRadius={10}
                  flexDirection='row'
                  justifyContent='center'
                  //transition={{backgroundColor: {interpolate:'color'}}}
                  onClick={e => {
                    this.showMessage('You clicked the button! Good for you.')
                  }}
                >Button</Block>
              </Block>

              <Block
                key='centerPane'
                x={-512}
                y={512}
                width={1024}
                height={1024}
                fontSize={24}
                justifyContent='space-between'
              >
                <Block {...headerStyles}>3D Contents</Block>
                <Block
                  key='top'
                  flexDirection='row'
                  minHeight='50%'
                  margin={[20, 0]}
                >
                  <Block
                    flex={1}
                    padding={50}
                    margin={[0, 20, 0, 0]}
                    borderColor={0x666666}
                    borderWidth={4}
                    borderRadius={10}
                  >
                    <FlexboxGlobe
                      flex={1}
                      animation={{
                        from: {rotateY: -Math.PI},
                        to: {rotateY: Math.PI},
                        duration: 24000,
                        iterations: Infinity
                      }}
                    />
                  </Block>
                  <Block
                    flex={1}
                    padding={100}
                    borderColor={0x666666}
                    borderWidth={4}
                    borderRadius={10}
                  >
                    <CubeOfCubes
                      flex={1}
                      onCubeOver={e => {
                        this.setState({isHoveringCube: true})
                        clearTimeout(this._cubeOutTimer)
                      }}
                      onCubeOut={e => {
                        clearTimeout(this._cubeOutTimer)
                        this._cubeOutTimer = setTimeout(() => {
                          this.setState({isHoveringCube: false})
                        }, 500)
                      }}
                      animation={{
                        from: {rotateX: -Math.PI, rotateY: -Math.PI, rotateZ: -Math.PI},
                        to: {rotateX: Math.PI, rotateY: Math.PI, rotateZ: Math.PI},
                        duration: 10000,
                        iterations: Infinity,
                        paused: state.isHoveringCube
                      }}
                    />
                  </Block>
                </Block>
                <Block
                  key='bottom'
                  flex={1}
                  backgroundColor={0x333333}
                  backgroundMaterial={mainPanelMaterial}
                >
                  <FlexboxLineGraph
                    key="lineGraph1"
                    position="absolute"
                    top={100}
                    left={0}
                    right={0}
                    bottom={100}
                    z={state.lineGraphsLayered ? (vr ? 30 : 15) : 0}
                    color={0x996600}
                    values={state.lineGraph1Values}
                    transition={{z: true}}
                  />
                  <FlexboxLineGraph
                    key="lineGraph2"
                    position="absolute"
                    top={150}
                    left={0}
                    right={0}
                    bottom={50}
                    z={state.lineGraphsLayered ? (vr ? 60 : 30) : 0}
                    color={0x006699}
                    values={state.lineGraph2Values}
                    transition={{z: true}}
                  />
                  <FlexboxLineGraph
                    key="lineGraph3"
                    position="absolute"
                    top={200}
                    left={0}
                    right={0}
                    bottom={0}
                    z={state.lineGraphsLayered ? (vr ? 90 : 45) : 0}
                    color={0x009966}
                    values={state.lineGraph3Values}
                    transition={{z: true}}
                  />
                  <Block
                    position="absolute"
                    top={10}
                    right={10}
                    color={0}
                    flexDirection="row"
                  >
                    <Icon
                      icon={state.lineGraphsLayered ? 'layers' : 'layers_clear'}
                      size={32}
                      lineHeight={1}
                      onClick={e => this.setState({lineGraphsLayered : !state.lineGraphsLayered})}
                      backgroundColor={0x666666}
                      borderRadius={5}
                      padding={5}
                      margin={[0, 5, 0, 0]}
                      pointerStates={{
                        hover: {backgroundColor: 0x999999},
                        active: {backgroundColor: 0xaaaaaa}
                      }}
                      transition={{backgroundColor: {interpolate:'color'}}}
                    />
                    <Icon
                      icon="refresh"
                      size={32}
                      lineHeight={1}
                      onClick={e => this.randomizeLineGraphs()}
                      backgroundColor={0x666666}
                      borderRadius={5}
                      padding={5}
                      pointerStates={{
                        hover: {backgroundColor: 0x999999},
                        active: {backgroundColor: 0xaaaaaa}
                      }}
                      transition={{backgroundColor: {interpolate:'color'}}}
                    />
                  </Block>
                </Block>
              </Block>

              <Block
                key='rightPane'
                x={512 + 20}
                y={512}
                width={512}
                height={1024}
                rotateY={Math.PI / -4}
                backgroundColor={0x333333}
                backgroundMaterial={mainPanelMaterial}
                padding={20}
                fontSize={24}
                font={FONT_URL}
                justifyContent='space-around'
              >
                <Block
                  backgroundColor={0x222222}
                  margin={10}
                  padding={10}
                >
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </Block>
                <Block
                  alignSelf='center'
                  backgroundColor={0x666666}
                  color={0}
                  margin={[20, 0, 0]}
                  padding={20}
                  borderRadius={20}
                  flexDirection="row"
                >Center</Block>

                {/*
                <Block
                  flexDirection="row"
                  margin={[20, 0, 0]}
                >
                  <ListFacade
                    data={[1, 2, 3, 4, 5]}
                    template={
                      // TODO not supported yet, due to stringification of `key` by React
                      // <Block
                      // key={d => d}
                      // text={d => `Item ${d}`}
                      // flex={1}
                      // />
                      {
                        key: d => d,
                        facade: Block,
                        text: d => `Item ${d}`
                      }
                    }
                  />
                </Block>
                */}

                <Block {...headerStyles}>Scrollable Text</Block>
                <Block
                  backgroundColor={0x222222}
                  padding={10}
                  minHeight={0}
                  flexShrink={1}
                >
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

                  <Block margin={[20, 0, 0]}>Nested horizontal scroll:</Block>
                  <Block
                    backgroundColor={0x666666}
                    flexDirection="row"
                    padding={5}
                    margin={[0, 0, 20]}
                    // children={[1,2,3,4,5,6,7,8].map(n =>
                    //   <Block
                    //     key={n}
                    //     padding={[10, 30]}
                    //     margin={5}
                    //     backgroundColor={0x444444}
                    //     pointerStates={{hover:{backgroundColor:0x444499}}}
                    //   >{n}</Block>
                    // )}
                    children={<ListFacade
                      data={[1,2,3,4,5,6,7,8]}
                      template={{
                        key: d => d,
                        facade: Block,
                        padding: [10, 30],
                        margin: 5,
                        backgroundColor: 0x664444,
                        pointerStates: {hover:{backgroundColor:0x994444}},
                        text: d => `#${d}`,
                        onClick: d => this.showMessage.bind(this, `Clicked Item #${d}`)
                      }}
                    />}
                  />

                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                </Block>
              </Block>

              { state.alertMessage ? (
                <Block
                  key={`msg${state.alertMessage.id}`}
                  x={-150}
                  y={-512}
                  z={100}
                  //rotateX={Math.PI / -3}
                  width={300}
                  backgroundColor={0x111111}
                  backgroundMaterial={mainPanelMaterial}
                  borderRadius={20}
                  borderWidth={3}
                  borderColor={0x009900}
                  padding={20}
                  font={FONT_URL}
                  fontSize={24}
                  alignItems='center'
                  animation={{
                    from: {scale: 1e-9, x: 0, rotateX: Math.PI / 3},
                    to: {scale: 1, x: -150, rotateX: Math.PI / -3},
                    easing: 'easeOutExpo'
                  }}
                  exitAnimation={{
                    from: {scale: 1, x: -150, rotateX: Math.PI / -3},
                    to: {scale: 1e-9, x: 0, rotateX: Math.PI / 3},
                    easing: 'easeOutExpo'
                  }}
                >
                  { state.alertMessage.text }
                  <Block
                    key='button'
                    padding={10}
                    margin={[20, 0, 0]}
                    backgroundColor={0x999999}
                    color={0}
                    borderRadius={10}
                    pointerStates={{
                      hover: {backgroundColor: 0xcccccc},
                      active: {backgroundColor: 0xffffff}
                    }}
                    onClick={e => {this.setState({alertMessage: null})}}
                  >OK</Block>
                </Block>
              ) : null }
            </Group3DFacade>
          }
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
