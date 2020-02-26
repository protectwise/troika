import React from 'react'
import T from 'prop-types'
import { Canvas3D, createDerivedMaterial, Object3DFacade } from 'troika-3d'
import {Text3DFacade} from 'troika-3d-text'
import {
  MeshBasicMaterial,
  MeshStandardMaterial,
  TextureLoader,
  PlaneBufferGeometry,
  Mesh
} from 'three'
import DatGui, {DatBoolean, DatSelect, DatNumber} from 'react-dat-gui'
import { DatGuiFacade } from 'troika-3d-ui'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'


const FONTS = {
  'Roboto': 'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff',
  'Noto Sans': 'https://fonts.gstatic.com/s/notosans/v7/o-0IIpQlx3QUlC5A4PNr5TRG.woff',
  //too thin: 'Alex Brush': 'https://fonts.gstatic.com/s/alexbrush/v8/SZc83FzrJKuqFbwMKk6EhUXz6w.woff',
  'Comfortaa': 'https://fonts.gstatic.com/s/comfortaa/v12/1Ptsg8LJRfWJmhDAuUs4TYFs.woff',
  'Cookie': 'https://fonts.gstatic.com/s/cookie/v8/syky-y18lb0tSbf9kgqU.woff',
  'Cutive Mono': 'https://fonts.gstatic.com/s/cutivemono/v6/m8JWjfRfY7WVjVi2E-K9H6RCTmg.woff',
  'Gabriela': 'https://fonts.gstatic.com/s/gabriela/v6/qkBWXvsO6sreR8E-b8m5xL0.woff',
  'Philosopher': 'https://fonts.gstatic.com/s/philosopher/v9/vEFV2_5QCwIS4_Dhez5jcWBuT0s.woff',
  'Quicksand': 'https://fonts.gstatic.com/s/quicksand/v7/6xKtdSZaM9iE8KbpRA_hK1QL.woff',
  'Trirong': 'https://fonts.gstatic.com/s/trirong/v3/7r3GqXNgp8wxdOdOn4so3g.woff',
  'Trocchi': 'https://fonts.gstatic.com/s/trocchi/v6/qWcqB6WkuIDxDZLcPrxeuw.woff',
  'Advent Pro': 'https://fonts.gstatic.com/s/adventpro/v7/V8mAoQfxVT4Dvddr_yOwhTqtLg.woff',
  'Henny Penny': 'https://fonts.gstatic.com/s/hennypenny/v5/wXKvE3UZookzsxz_kjGSfPQtvXQ.woff',
  'Orbitron': 'https://fonts.gstatic.com/s/orbitron/v9/yMJRMIlzdpvBhQQL_Qq7dys.woff',
  'Sacramento': 'https://fonts.gstatic.com/s/sacramento/v5/buEzpo6gcdjy0EiZMBUG4C0f-w.woff',
  'Snowburst One': 'https://fonts.gstatic.com/s/snowburstone/v5/MQpS-WezKdujBsXY3B7I-UT7SZieOA.woff',
  'Syncopate': 'https://fonts.gstatic.com/s/syncopate/v9/pe0sMIuPIYBCpEV5eFdCBfe5.woff',
  'Wallpoet': 'https://fonts.gstatic.com/s/wallpoet/v9/f0X10em2_8RnXVVdUObp58I.woff',
  'Sirin Stencil': 'https://fonts.gstatic.com/s/sirinstencil/v6/mem4YaWwznmLx-lzGfN7MdRyRc9MAQ.woff'
}

const CUSTOM_LBL = '(Custom...)'

const TEXTS = {
  'Lorem Ipsum': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Gettysburg': `  Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.

  Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.

  But, in a larger sense, we can not dedicate — we can not consecrate — we can not hallow — this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us — that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion — that we here highly resolve that these dead shall not have died in vain — that this nation, under God, shall have a new birth of freedom — and that government of the people, by the people, for the people, shall not perish from the earth.

Abraham Lincoln
November 19, 1863`,
  'ABC123': 'abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {}',

  // TODO bring back custom text, but need to figure it out for XR:
  // [CUSTOM_LBL]: 'Edit me!'
}

const TEXTURE = new TextureLoader().load('shader-anim/lava.jpg')
const MATERIALS = {
  'MeshBasicMaterial': new MeshBasicMaterial(),
  'MeshStandardMaterial': new MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.5
  }),
  'Custom Vertex Shader': createDerivedMaterial(new MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.5
  }), {
    timeUniform: 'elapsed',
    vertexTransform: `
      float waveAmplitude = 0.1;
      float waveX = uv.x * PI * 4.0 - mod(elapsed / 300.0, PI2);
      float waveZ = sin(waveX) * waveAmplitude;
      normal.xyz = normalize(vec3(-cos(waveX) * waveAmplitude, 0.0, 1.0));
      position.z += waveZ;
    `
  })
}
const MATERIAL_OPTS = Object.keys(MATERIALS)
Object.keys(MATERIALS).forEach(name => {
  MATERIALS[name + '+Texture'] = MATERIALS[name].clone()
  MATERIALS[name + '+Texture'].map = TEXTURE
})

class TextExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      text: 'Lorem Ipsum',
      font: 'Noto Sans',
      fontSize: 0.1, //10cm
      textScale: 1,
      lineHeight: 1.15,
      letterSpacing: 0,
      maxWidth: 2, //2m
      textAlign: 'justify',
      color: 0xffffff,
      fog: false,
      animTextColor: true,
      animTilt: true,
      animRotate: false,
      material: 'MeshStandardMaterial',
      useTexture: false,
      shadows: false,
      selectable: false,
      debugSDF: false
    }

    this._onConfigUpdate = (newState) => {
      if (newState.text === 'Gettysburg' && newState.text !== this.state.text) {
        newState.textScale = 0.5
        newState.maxWidth = 2.5
      }
      this.setState(newState)
    }
  }

  render() {
    let state = this.state
    let {width, height} = this.props

    let material = state.material
    if (state.useTexture) material += '+Texture'
    material = MATERIALS[material]

    return (
      <div>
        <Canvas3D
          antialias
          shadows={ state.shadows }
          stats={ this.props.stats }
          width={ width }
          height={ height }
          camera={ {
            fov: 75,
            aspect: width / height,
            x: 0,
            y: 0,
            z: 2
          } }
          lights={[
            {type: 'ambient', color: 0x666666},
            {
              type: 'point',
              z: 2,
              y: 1,
              x: 0,
              castShadow: state.shadows,
              shadow: {
                mapSize: {width: 1024, height: 1024},
                // camera: {far: 10, near: 0.1, left: -3, right: 3, top: 3, bottom: -3}
              },
              animation: {
                from: {x: 1},
                to: {x: -1},
                iterations: Infinity,
                direction: 'alternate',
                easing: 'easeInOutSine',
                duration: 2000
              }
            }
          ]}
          fog={state.fog ? {
            color: 0x222222,
            density: 0.75
          } : null}
          objects={ [
            {
              key: 'text',
              facade: Text3DFacade,
              castShadow: state.shadows,
              text: TEXTS[state.text],
              font: FONTS[state.font],
              fontSize: state.fontSize,
              maxWidth: state.maxWidth,
              textAlign: state.textAlign,
              lineHeight: state.lineHeight,
              letterSpacing: state.letterSpacing,
              anchor: [0.5, 0.5],
              selectable: state.selectable,
              debugSDF: state.debugSDF,
              material: material,
              color: 0xffffff,
              scaleX: state.textScale || 1,
              scaleY: state.textScale || 1,
              scaleZ: state.textScale || 1,
              rotateX: 0,
              rotateZ: 0,
              transition: {
                scaleX: true,
                scaleY: true,
                scaleZ: true
              },
              // onMouseOver() {
              //   console.log('mouseover')
              // },
              // onMouseOut() {
              //   console.log('mouseout')
              // },
              animation: [
                state.animTilt ? {
                  from: {rotateX: 0},
                  25: {rotateX: Math.PI / 5},
                  50: {rotateX: 0},
                  75: {rotateX: Math.PI / -5},
                  to: {rotateX: 0},
                  duration: 10000,
                  iterations: Infinity
                } : null,
                state.animTextColor ? {
                  from: {color: 0x6666ff},
                  33: {color: 0x66ff66},
                  66: {color: 0xff6666},
                  to: {color: 0x6666ff},
                  interpolate: {color: 'color'},
                  iterations: Infinity,
                  duration: 5000
                } : null,
                state.animRotate ? {
                  from: {rotateZ: 0},
                  to: {rotateZ: Math.PI * 2},
                  duration: 10000,
                  iterations: Infinity
                } : null
              ]
            },
            state.shadows ? {
              key: 'plane',
              facade: ShadowSurface,
              receiveShadow: true,
              scale: 3,
              rotateX: Math.PI / -6,
              z: -1
            } : null,
            {
              key: 'config',
              isXR: !!this.props.vr,
              facade: ExampleConfigurator,
              data: state,
              onUpdate: this._onConfigUpdate,
              items: [
                {type: 'select', path: 'text', options: Object.keys(TEXTS)},
                {type: 'select', path: 'font', options: Object.keys(FONTS).sort()},
                {type: 'select', path: 'textAlign', options: ['left', 'right', 'center', 'justify']},
                {type: 'select', path: "material", options: MATERIAL_OPTS},
                {type: 'boolean', path: "useTexture", label: "Texture"},
                {type: 'boolean', path: "animTextColor", label: "Cycle Colors"},
                {type: 'boolean', path: "animTilt", label: "Tilt"},
                {type: 'boolean', path: "animRotate", label: "Rotate"},
                {type: 'boolean', path: "fog", label: "Fog"},
                {type: 'boolean', path: "shadows", label: "Shadows"},
                {type: 'boolean', path: "debugSDF", label: "Show SDF"},
                {type: 'boolean', path: "selectable", label: "Selectable (WIP)"},
                {type: 'number', path: "fontSize", label: "fontSize", min: 0.01, max: 0.2, step: 0.01},
                {type: 'number', path: "textScale", label: "scale", min: 0.1, max: 10, step: 0.1},
                {type: 'number', path: "maxWidth", min: 1, max: 5, step: 0.01},
                {type: 'number', path: "lineHeight", min: 1, max: 2, step: 0.01},
                {type: 'number', path: "letterSpacing", min: -0.1, max: 0.5, step: 0.01}
              ]
            }
          ] }
        />

        {/*<DatGui data={state} onUpdate={this._onConfigUpdate}>
          <DatSelect path='text' options={Object.keys(TEXTS)} />
          { state.text === CUSTOM_LBL ? (
            <textarea
              style={{position:'absolute', left:'100%', width:300, height: 120}}
              value={TEXTS[CUSTOM_LBL]}
              onChange={e => {
                TEXTS[CUSTOM_LBL] = e.target.value
                this.forceUpdate()
              }}
            />
          ) : null }

          <DatSelect path='font' options={Object.keys(FONTS).sort()} />
          <DatSelect path='textAlign' options={['left', 'right', 'center', 'justify']} />
          <DatSelect path="material" options={MATERIAL_OPTS} />
          <DatBoolean path="useTexture" label="Texture" />

          <DatBoolean path="animTextColor" label="Cycle Colors" />
          <DatBoolean path="animTilt" label="Tilt" />
          <DatBoolean path="animRotate" label="Rotate" />
          <DatBoolean path="fog" label="Fog" />
          <DatBoolean path="shadows" label="Shadows" />
          <DatBoolean path="debugSDF" label="Show SDF" />

          <DatBoolean path="selectable" label="Selectable (WIP)" />
          <DatNumber path="fontSize" label="fontSize" min={0.01} max={0.2} step={0.01} />
          <DatNumber path="textScale" label="scale" min={0.1} max={10} step={0.1} />
          <DatNumber path="maxWidth" min={1} max={5} step={0.01} />
          <DatNumber path="lineHeight" min={1} max={2} step={0.01} />
          <DatNumber path="letterSpacing" min={-0.1} max={0.5} step={0.01} />
        </DatGui>*/}


        <div className="example_desc">
          <p>This demonstrates Troika's high quality text rendering, which uses Signed Distance Field ("SDF") texture atlases for crisp glyph vector edges at any scale. It can be used via <a href="https://github.com/protectwise/troika/blob/master/packages/troika-3d-text/src/facade/Text3DFacade.js">Text3DFacade</a> or outside the Troika framework as a standalone Three.js <a href="https://github.com/protectwise/troika/blob/master/packages/troika-3d-text/src/three/TextMesh.js">TextMesh</a>.</p>
          <p>Behind the scenes it uses <a href="https://github.com/photopea/Typr.js">Typr.js</a> to parse fonts, giving it support for font features such as kerning and ligatures. It generates SDF textures for each glyph on the fly as needed, assembles a single geometry for all the glyphs, seamlessly upgrades any Material's shaders to support the SDFs with high quality antialiasing, and renders the whole thing in a single draw call. Font parsing and SDF generation is done in a web worker so frames won't be dropped during processing.</p>
        </div>
      </div>
    )
  }
}


class ShadowSurface extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(
      new PlaneBufferGeometry(),
      new MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.5
      })
    ))
  }
}


TextExample.propTypes = {
  width: T.number,
  height: T.number
}

export default TextExample
