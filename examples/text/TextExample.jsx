import React from 'react'
import T from 'prop-types'
import {Canvas3D, Text3DFacade} from '../../src/index'
import {MeshStandardMaterial} from 'three'


const FONTS = {
  'Roboto': 'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff',
  'Noto Sans': 'https://fonts.gstatic.com/s/notosans/v7/o-0IIpQlx3QUlC5A4PNr5TRG.woff',
  //too thin: 'Alex Brush': 'https://fonts.gstatic.com/s/alexbrush/v8/SZc83FzrJKuqFbwMKk6EhUXz6w.woff',
  'Comfortaa': 'https://fonts.gstatic.com/s/comfortaa/v12/1Ptsg8LJRfWJmhDAuUs4TYFs.woff',
  'Cookie': 'https://fonts.gstatic.com/s/cookie/v8/syky-y18lb0tSbf9kgqU.woff',
  //throws: 'Cutive Mono': 'https://fonts.gstatic.com/s/cutivemono/v6/m8JWjfRfY7WVjVi2E-K9H6RCTmg.woff',
  //throws: 'Gabriela': 'https://fonts.gstatic.com/s/gabriela/v6/qkBWXvsO6sreR8E-b8m5xL0.woff',
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

const TEXTS = {
  'Lorem Ipsum': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Gettysburg': `  Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.

  Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.
  
  But, in a larger sense, we can not dedicate — we can not consecrate — we can not hallow — this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us — that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion — that we here highly resolve that these dead shall not have died in vain — that this nation, under God, shall have a new birth of freedom — and that government of the people, by the people, for the people, shall not perish from the earth.

Abraham Lincoln
November 19, 1863`,
  'ABC123': 'abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {} abc def ghi jkl mno pqrs tuv wxyz ABC DEF GHI JKL MNO PQRS TUV WXYZ !"§ $%& /() =?* \'<> #|; ²³~ @`´ ©«» ¤¼× {}'
}

const customMaterial = new MeshStandardMaterial({})


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
      animTextColor: true,
      animTilt: true,
      animRotate: false,
      useCustomMaterial: false,
      debugSDF: false
    }
  }

  componentWillMount() {
  }

  render() {
    let state = this.state
    let {width, height} = this.props

    return (
      <div>
        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={ width }
          height={ height }
          camera={ {
            fov: 75,
            aspect: width / height,
            near: 0.1,
            far: 20000,
            x: 0,
            y: 0,
            z: 2,
            lookAt: {x: 0, y: 0, z: 0}
          } }
          lights={ state.useCustomMaterial ? [
            {type: 'ambient', color: 0x666666},
            {
              type: 'point',
              z: 4,
              animation: {
                from: {x: 5},
                to: {x: -5},
                iterations: Infinity,
                direction: 'alternate',
                easing: 'easeInOutSine',
                duration: 2000
              }
            }
          ] : null }
          objects={ [
            {
              key: 'text',
              facade: Text3DFacade,
              text: TEXTS[state.text],
              font: FONTS[state.font],
              fontSize: state.fontSize,
              maxWidth: state.maxWidth,
              textAlign: state.textAlign,
              lineHeight: state.lineHeight,
              letterSpacing: state.letterSpacing,
              anchor: [0.5, 0.5],
              debugSDF: state.debugSDF,
              material: state.useCustomMaterial ? customMaterial : null,
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
            }
          ] }
        />

        <div className="example_controls">
          { this.renderSelect('text', 'Choose Text', Object.keys(TEXTS), val => {
            if (val === 'Gettysburg') {
              this.setState({textScale: 0.5, maxWidth: 2.5})
            }
          }) }
          { this.renderSelect('font', 'Choose Font', Object.keys(FONTS).sort()) }
          { this.renderSelect('textAlign', 'Choose Alignment', ['left', 'right', 'center', 'justify']) }

          { this.renderToggle('animTextColor', 'Cycle Colors')}
          { this.renderToggle('animTilt', 'Tilt')}
          { this.renderToggle('animRotate', 'Rotate')}
          { this.renderToggle('useCustomMaterial', 'Custom Material')}
          { this.renderToggle('debugSDF', 'Show SDF Textures')}

          { this.renderRange('textScale', 'Scale', 0.1, 10, 0.1) }
          { this.renderRange('maxWidth', 'Max Width', 1, 5, 0.01) }
          { this.renderRange('lineHeight', 'Line Height', 1, 2, 0.01) }
          { this.renderRange('letterSpacing', 'Letter Spacing', -0.1, 0.5, 0.01) }

        </div>

        <div className="example_desc">
          <p>This demonstrates Text3DFacade and its high quality text rendering engine, which uses Signed Distance Field ("SDF") texture atlases for crisp glyph vector edges at any scale.</p>
          <p>Behind the scenes it uses <a href="https://opentype.js.org/">opentype.js</a> to parse fonts, and thus has full support for font features such as kerning and ligatures. It generates SDF textures for each glyph as it is used, assembles a single geometry for all the glyphs, seamlessly upgrades any Material's shaders to support the SDFs with high quality antialiasing, and renders the whole thing in a single draw call.</p>
          <p>Most of the font parsing and SDF generation is done in a web worker so frames won't be dropped during processing.</p>
        </div>
      </div>
    )
  }

  renderToggle(stateName, label) {
    return <label style={{display:'block', marginTop: 10}}>
      <input
        type="checkbox"
        checked={!!this.state[stateName]}
        onChange={e => {
          this.setState({[stateName]: !this.state[stateName]})
        }}
      /> {label}
    </label>
  }

  renderSelect(stateName, label, options, callback) {
    return <select
      style={{marginTop: 10}}
      onChange={e => {
        const val = e.target.value
        this.setState({[stateName]: val}, callback && (() => callback(val)))
      }}
    >
      <optgroup label={label}>
        {options.map(v =>
          <option key={v} value={v} selected={v === this.state[stateName]}>{v}</option>
        )}
      </optgroup>
    </select>
  }

  renderRange(stateName, label, min, max, step) {
    return [
      <div key="label" style={{marginTop: 10}}>{label}: {this.state[stateName]}</div>,
      <input key="input" type="range" min={min} max={max} step={step} value={this.state[stateName]} onChange={e => {
        this.setState({[stateName]: +e.target.value})
      }} />
    ]
  }
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}


TextExample.propTypes = {
  width: T.number,
  height: T.number
}

export default TextExample
