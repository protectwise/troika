import React from 'react'
import ReactDOM from 'react-dom'
import CityGrid from './citygrid/CityGrid'
import ShaderAnim from './shader-anim/ShaderAnim'
import Arcs from './arcs/Arcs'
import GlobeExample from './globe/GlobeExample'
import HtmlOverlays from './html-overlays/HtmlOverlaysExample'
import DragDrop from './dragdrop/DragDropExample'
import LevelOfDetail from './lod/LevelOfDetailExample'
import CurveAnim from './curve-anim/CurveAnimExample'
import Canvas2DExample from './canvas2d/Canvas2DExample'


const EXAMPLES = [
  {id: 'citygrid', name: 'City', component: CityGrid},
  {id: 'shaderanim', name: 'Animated Shaders', component: ShaderAnim},
  {id: 'arcs', name: 'Arcs', component: Arcs},
  {id: 'globe', name: 'Globe', component: GlobeExample},
  {id: 'htmlOverlays', name: 'HTML Overlays', component: HtmlOverlays},
  {id: 'dragdrop', name: 'Drag and Drop', component: DragDrop},
  {id: 'lod', name: 'Level of Detail', component: LevelOfDetail},
  {id: 'curveAnim', name: 'Curve Animation', component: CurveAnim},
  {id: 'twoDee', name: 'Canvas2D', component: Canvas2DExample}
]

const ExamplesApp = React.createClass({
  componentWillMount() {
    window.addEventListener('hashchange', this._onHashChange, false)
    window.addEventListener('resize', this._onWindowResize, false)
  },

  componentWillUnmount() {
    window.removeEventListener('hashchange', this._onHashChange, false)
    window.removeEventListener('resize', this._onWindowResize, false)
  },

  getInitialState() {
    return {
      selectedExampleId: (location.hash && location.hash.replace(/^#/, '')) || EXAMPLES[0].id,
      bodyWidth: null,
      bodyHeight: null
    }
  },

  _onBodyElRef(el) {
    this._bodyEl = el
    if (el) {
      this._onWindowResize()
    }
  },

  _onWindowResize() {
    let box = this._bodyEl.getBoundingClientRect()
    this.setState({bodyWidth: box.width, bodyHeight: box.height})
  },

  _onHashChange() {
    this.setState({
      selectedExampleId: location.hash.replace(/^#/, '')
    })
  },

  _onExampleSelect(e) {
    location.hash = EXAMPLES[e.target.selectedIndex].id
  },

  render() {
    let {selectedExampleId, bodyWidth, bodyHeight} = this.state
    let example = EXAMPLES.filter(({id}) => id === selectedExampleId)[0]
    let ExampleCmp = example && example.component

    return (
      <div className="examples">
        <header className="examples_header">
          <h1>Troika Examples</h1>
          <select onChange={ this._onExampleSelect }>
            { EXAMPLES.map(example =>
              <option selected={ example.id === this.state.selectedExampleId }>{ example.name }</option>
            ) }
          </select>
        </header>
        <section className="examples_body" ref={ this._onBodyElRef }>
          { ExampleCmp ?
            (bodyWidth && bodyHeight ? <ExampleCmp width={ bodyWidth } height={ bodyHeight } /> : null) :
            `Unknown example: ${selectedExampleId}`
          }
        </section>
      </div>
    )
  }
})

ReactDOM.render(<ExamplesApp />, document.body)
