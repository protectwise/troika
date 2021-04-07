import React from 'react'
import T from 'prop-types'
import { Canvas3D, createDerivedMaterial, Object3DFacade } from 'troika-3d'
import {Text3DFacade, dumpSDFTextures} from 'troika-3d-text'
import {
  MeshBasicMaterial,
  MeshStandardMaterial,
  TextureLoader,
  PlaneBufferGeometry,
  Mesh,
  Color,
  DoubleSide
} from 'three'
import DatGui, {DatBoolean, DatSelect, DatNumber} from 'react-dat-gui'
import { DatGuiFacade } from 'troika-3d-ui'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'


const FONTS = {
  'Amiri': 'https://fonts.gstatic.com/s/amiri/v17/J7aRnpd8CGxBHqUq.woff',
  'Cairo': 'https://fonts.gstatic.com/s/cairo/v10/SLXGc1nY6HkvamIl.woff',
  'Lemonada': 'https://fonts.gstatic.com/s/lemonada/v12/0QI-MXFD9oygTWy_R-FFlwV-bgfR7QJGeut2mg.woff',
  'Mirza': 'https://fonts.gstatic.com/s/mirza/v10/co3ImWlikiN5Eure.woff',
  //'Reem Kufi': 'https://fonts.gstatic.com/s/reemkufi/v10/2sDcZGJLip7W2J7v7wQDbA.woff',
  'Scheherazade': 'https://fonts.gstatic.com/s/scheherazade/v20/YA9Ur0yF4ETZN60keViq1kQgtA.woff',
  'Roboto': 'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff',
  'Noto Sans': 'https://fonts.gstatic.com/s/notosans/v7/o-0IIpQlx3QUlC5A4PNr5TRG.woff',
}

const CUSTOM_LBL = '(Custom...)'

const TEXTS = {
  'Lorem Ipsum': 'لكن لا بد أن أوضح لك أن كل هذه الأفكار المغلوطة حول استنكار  النشوة وتمجيد الألم نشأت بالفعل، وسأعرض لك التفاصيل لتكتشف حقيقة وأساس تلك السعادة البشرية، فلا و سأعرض مثال حي لهذا، من منا لم يتحمل جهد بدني شاق إلا من أجل الحصول على ميزة أو فائدة؟ ولكن من لديه الحق أن ينتقد شخص ما أراد أن يشعر بالسعادة التي لا تشوبها عواقب أليمة أو آخر أراد أن يتجنب الألم الذي ربما تنجم عنه بعض المتعة ؟\n\nعلي الجانب الآخر نشجب ونستنكر هؤلاء الرجال المفتونون بنشوة اللحظة الهائمون في رغباتهم فلا يدركون ما يعقبها من الألم والأسي المحتم، واللوم كذلك يشمل هؤلاء الذين أخفقوا في واجباتهم نتيجة لضعف إرادتهم فيتساوي مع هؤلاء الذين يتجنبون وينأون عن تحمل الكدح والألم . من المفترض أن نفرق بين هذه الحالات بكل سهولة ومرونة. في ذاك الوقت عندما تكون قدرتنا علي الاختيار غير مقيدة بشرط وعندما لا نجد ما يمنعنا أن نفعل الأفضل فها نحن نرحب بالسرور والسعادة ونتجنب كل ما يبعث إلينا الألم. في بعض الأحيان ونظراً للالتزامات التي يفرضها علينا الواجب والعمل سنتنازل غالباً ونرفض الشعور بالسرور ونقبل ما يجلبه إلينا الأسى. الإنسان الحكيم عليه أن يمسك زمام الأمور ويختار إما أن يرفض مصادر السعادة من أجل ما هو أكثر أهمية أو يتحمل الألم من أجل ألا يتحمل ما هو أسوأ.',

  'One': 'يَجِبُ عَلَى الإنْسَانِ أن يَكُونَ أمِيْنَاً وَصَادِقَاً مَعَ نَفْسِهِ وَمَعَ أَهْلِهِ وَجِيْرَانِهِ وَأَنْ يَبْذُلَ كُلَّ جُهْدٍ فِي إِعْلاءِ شَأْنِ الوَطَنِ وَأَنْ يَعْمَلَ عَلَى مَا يَجْلِبُ السَّعَادَةَ لِلنَّاسِ . ولَن يَتِمَّ لَهُ ذلِك إِلا بِأَنْ يُقَدِّمَ المَنْفَعَةَ العَامَّةَ عَلَى المَنْفَعَةِ الخَاصَّةِ وَهذَا مِثَالٌ لِلتَّضْحِيَةِ .',

  Two: 'السلام عليكم',

  Three: 'وللناس مذاهبهم المختلفة في التخفف من الهموم والتخلص من الأحزان، فمنهم من يتسلى عنها بالقراءة، ومنهم من يتسلى عنها بالرياضة، ومنهم من يتسلى عنها بالاستماع للموسيقى والغناء، ومنهم من يذهب غير هذه المذاهب كلها لينسى نفسه ويفر من حياته الحاضرة وما تثقله به من الأعباء.',

  'BiDi 1': `ان عدة الشهور عند الله اثنا عشر شهرا في كتاب الله يوم خلق السماوات والارض \u202DSOME LATIN TEXT HERE\u202C منها اربعة حرم ذلك الدين القيم فلاتظلموا فيهن انفسكم وقاتلوا المشركين كافة كما يقاتلونكم كافة واعلموا ان الله مع المتقين `,

  [CUSTOM_LBL]: 'نص'
  //[CUSTOM_LBL]: 'abc def ghi jkl mno pqr stu vwx yz \u202EABC DEF GHI JKL MNO \u202Dabc def ghi jkl \u202E123 456 7890\u202C mno pqr stu vwx yz\u202C PQR STU VWX YZ\u202C abc def ghi jkl mno pqr stu vwx yz'
}

const TEXTURE = new TextureLoader().load('shader-anim/lava.jpg')
const MATERIALS = {
  'MeshBasicMaterial': new MeshBasicMaterial({
    side: DoubleSide,
    depthTest: false
  }),
  'MeshStandardMaterial': new MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.5,
    side: DoubleSide,
    depthTest: false
  }),
  'Custom Vertex Shader': createDerivedMaterial(new MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.5,
    side: DoubleSide,
    depthTest: false
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
      text: CUSTOM_LBL,
      font: 'Scheherazade',
      direction: 'rtl',
      fontSize: 0.1, //10cm
      textScale: 1,
      lineHeight: 1.15,
      letterSpacing: 0,
      maxWidth: 2, //2m
      textAlign: 'right',
      textIndent: 0,
      anchorX: 'center',
      anchorY: 'middle',
      color: 0xffffff,
      fillOpacity: 1,
      strokeOpacity: 1,
      strokeColor: 0x808080,
      strokeWidth: 0,
      outlineWidth: 0,
      outlineOffsetX: 0,
      outlineOffsetY: 0,
      outlineOpacity: 1,
      outlineBlur: 0,
      curveRadius: 0,
      fog: false,
      animTextColor: false,
      animTilt: false,
      animRotate: false,
      material: 'MeshStandardMaterial',
      useTexture: false,
      shadows: false,
      selectable: true,
      colorRanges: false,
      sdfGlyphSize: 6,
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
              z: 3,
              y: 1.5,
              x: 0,
              castShadow: state.shadows,
              shadow: {
                mapSize: {width: 1024, height: 1024},
                // camera: {far: 10, near: 0.1, left: -3, right: 3, top: 3, bottom: -3}
              },
              // animation: {
              //   from: {x: 1},
              //   to: {x: -1},
              //   iterations: Infinity,
              //   direction: 'alternate',
              //   easing: 'easeInOutSine',
              //   duration: 2000
              // }
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
              direction: state.direction,
              textAlign: state.textAlign,
              textIndent: state.textIndent,
              lineHeight: state.lineHeight,
              letterSpacing: state.letterSpacing,
              anchorX: state.anchorX,
              anchorY: state.anchorY,
              selectable: state.selectable,
              debugSDF: state.debugSDF,
              fillOpacity: state.fillOpacity,
              outlineWidth: state.outlineWidth,
              outlineOffsetX: state.outlineOffsetX,
              outlineOffsetY: state.outlineOffsetY,
              outlineOpacity: state.outlineOpacity,
              outlineBlur: state.outlineBlur,
              strokeOpacity: state.strokeOpacity,
              strokeWidth: state.strokeWidth,
              strokeColor: state.strokeColor,
              curveRadius: state.curveRadius,
              material: material,
              color: 0xffffff,
              scaleX: state.textScale || 1,
              scaleY: state.textScale || 1,
              scaleZ: state.textScale || 1,
              rotateX: 0,
              rotateZ: 0,
              sdfGlyphSize: Math.pow(2, state.sdfGlyphSize),
              onSyncComplete() {
                console.log(this.textRenderInfo.timings)
              },
              // onMouseMove: e => {
              //   this.setState({hoverPoint: e.intersection.point})
              // },
              colorRanges: state.colorRanges ? TEXTS[state.text].split('').reduce((out, char, i) => {
                if (i === 0 || /\s/.test(char)) {
                  out[i] = (Math.floor(Math.pow(Math.sin(i), 2) * 256) << 16)
                    | (Math.floor(Math.pow(Math.sin(i + 1), 2) * 256) << 8)
                    | (Math.floor(Math.pow(Math.sin(i + 2), 2) * 256))
                  //out[i] = '#' + new Color(out[i]).getHexString()
                }
                return out
              }, {}) : null,
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
                  from: {rotateY: 0},
                  to: {rotateY: Math.PI * 2},
                  duration: 10000,
                  iterations: Infinity
                } : null
              ],
              // children: {
              //   key: 'bbox',
              //   facade: TextBBoxHelper
              // }
            },
            // state.hoverPoint ? {
            //   key: 'hover',
            //   facade: SphereFacade,
            //   radius: state.fontSize / 10,
            //   x: state.hoverPoint.x,
            //   y: state.hoverPoint.y,
            //   z: state.hoverPoint.z
            // } : null,
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
                {type: 'select', path: 'direction', options: ['ltr', 'rtl']},
                {type: 'select', path: 'textAlign', options: ['left', 'right', 'center', 'justify']},
                {type: 'select', path: 'anchorX', options: ['left', 'right', 'center']},
                {type: 'select', path: 'anchorY', options: ['top', 'top-baseline', 'middle', 'bottom-baseline', 'bottom']},
                {type: 'select', path: "material", options: MATERIAL_OPTS},
                {type: 'boolean', path: "useTexture", label: "Texture"},
                {type: 'boolean', path: "animTextColor", label: "Cycle Colors"},
                {type: 'boolean', path: "animTilt", label: "Tilt"},
                {type: 'boolean', path: "animRotate", label: "Rotate"},
                {type: 'boolean', path: "fog", label: "Fog"},
                {type: 'boolean', path: "shadows", label: "Shadows"},
                {type: 'boolean', path: "colorRanges", label: "colorRanges (WIP)"},
                {type: 'boolean', path: "selectable", label: "Selectable (WIP)"},
                {type: 'number', path: "fontSize", label: "fontSize", min: 0.01, max: 0.2, step: 0.01},
                {type: 'number', path: "textScale", label: "scale", min: 0.1, max: 10, step: 0.1},
                //{type: 'number', path: "textIndent", label: "indent", min: 0.1, max: 1, step: 0.01},
                {type: 'number', path: "maxWidth", min: 1, max: 5, step: 0.01},
                {type: 'number', path: "lineHeight", min: 1, max: 2, step: 0.01},
                {type: 'number', path: "letterSpacing", min: -0.1, max: 0.5, step: 0.01},
                {type: 'number', path: "fillOpacity", min: 0, max: 1, step: 0.0001},
                {type: 'number', path: "curveRadius", min: -5, max: 5, step: 0.001},

                {type: 'number', path: "outlineWidth", min: 0, max: 0.05, step: 0.0001},
                {type: 'number', path: "outlineOpacity", min: 0, max: 1, step: 0.0001},
                {type: 'number', path: "outlineOffsetX", min: -0.05, max: 0.05, step: 0.0001},
                {type: 'number', path: "outlineOffsetY", min: -0.05, max: 0.05, step: 0.0001},
                {type: 'number', path: "outlineBlur", min: 0, max: 0.05, step: 0.0001},

                {type: 'number', path: "strokeOpacity", min: 0, max: 1, step: 0.0001},
                {type: 'number', path: "strokeWidth", min: 0, max: 0.01, step: 0.0001},

                {type: 'number', path: "sdfGlyphSize", label: 'SDF size (2^n):', min: 3, max: 8},
                {type: 'boolean', path: "debugSDF", label: "Show SDF"},
              ]
            }
          ] }
        />

        { state.text === CUSTOM_LBL ? (
          <textarea
            style={{position:'absolute', left:280, top:0, width:300, height: 120, fontFamily: 'serif'}}
            value={TEXTS[CUSTOM_LBL]}
            onChange={e => {
              TEXTS[CUSTOM_LBL] = e.target.value
              this.forceUpdate()
            }}
          />
        ) : null }

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
          <p>Behind the scenes it uses <a href="https://github.com/fredli74/Typr.ts">Typr</a> to parse fonts, giving it support for font features such as kerning and ligatures. It generates SDF textures for each glyph on the fly as needed, assembles a single geometry for all the glyphs, seamlessly upgrades any Material's shaders to support the SDFs with high quality antialiasing, and renders the whole thing in a single draw call. Font parsing and SDF generation is done in a web worker so frames won't be dropped during processing.</p>
        </div>
      </div>
    )
  }
}


class ShadowSurface extends Object3DFacade {
  initThreeObject() {
    return new Mesh(
      new PlaneBufferGeometry(),
      new MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.5
      })
    )
  }
}

//Helper to show the geometry's boundingBox - add as child of the Text3DFacade
/*
class TextBBoxHelper extends Object3DFacade {
  constructor (parent) {
    const helper = new Box3Helper(new Box3())
    super(parent, helper)
    helper.matrixAutoUpdate = true
  }
  updateMatrices() {
    this.threeObject.box = this.parent.threeObject.geometry.boundingBox || new Box3()
    this.threeObject.updateMatrixWorld(true)
  }
}
*/

TextExample.propTypes = {
  width: T.number,
  height: T.number
}

window.dumpSDFTextures = dumpSDFTextures

export default TextExample
