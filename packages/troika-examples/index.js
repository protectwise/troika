import React from 'react'
import ReactDOM from 'react-dom'
import { makeVrAware } from 'troika-xr'
import CityGrid from './citygrid/CityGrid'
import ShaderAnim from './shader-anim/ShaderAnim'
import ArcsExample from './arcs/ArcsExample'
import GlobeExample from './globe/GlobeExample'
import GlobeConnectionsExample from './globe-connections/GlobeConnectionsExample'
import HtmlOverlays from './html-overlays/HtmlOverlaysExample'
import TextExample from './text/TextExample'
import UIExample from './ui2/UIExample'
import DragDrop from './dragdrop/DragDropExample'
import LevelOfDetail from './lod/LevelOfDetailExample'
import CurveAnim from './curve-anim/CurveAnimExample'
import Bezier3DExample from './bezier-3d/Bezier3DExample'
import Canvas2DExample from './canvas2d/Canvas2DExample'
import EasingsExample from './easings/EasingsExample'
import InstanceableExample from './instanceable/InstanceableExample'
import InceptionExample from './inception/InceptionExample'
import RigidBodyExample from './physics/rigidBody/RigidBodyExample'
import SoftBodyExample from './physics/softBody/SoftBodyExample'
import KinematicsExample from './physics/kinematics/KinematicsExample'
import CollisionEventExample from './physics/collisionEvents/CollisionEventExample'

import 'react-dat-gui/dist/index.css'
import './index.css'


const EXAMPLES = [
  {id: 'citygrid', name: 'City', component: CityGrid, disableVR:true}, //fps too low for vr, too many draw calls
  {id: 'shaderanim', name: 'Animated Shaders', component: ShaderAnim},
  {id: 'arcs', name: 'Arcs', component: ArcsExample},
  {id: 'globe', name: 'Globe', component: GlobeExample},
  {id: 'globeConnections', name: 'Globe Connections', component: GlobeConnectionsExample},
  {id: 'htmlOverlays', name: 'HTML Overlays', component: HtmlOverlays},
  {id: 'text', name: '3D Text', component: TextExample},
  {id: 'ui', name: 'User Interface', component: UIExample},
  {id: 'dragdrop', name: 'Drag and Drop', component: DragDrop},
  {id: 'lod', name: 'Level of Detail', component: LevelOfDetail},
  {id: 'curveAnim', name: 'Line Graph', component: CurveAnim, disableVR:true},
  {id: 'bezier3d', name: '3D Bezier Tubes', component: Bezier3DExample},
  {id: 'twoDee', name: 'Canvas2D', component: Canvas2DExample, disableVR:true},
  {id: 'easings', name: 'Animation Easings', component: EasingsExample, disableVR:true},
  {id: 'instanceable', name: 'Instanceable Objects', component: InstanceableExample},
  {id: 'inception', name: 'Inception', component: InceptionExample},
  {id: 'physics-rigid-body', name: 'Physics / Rigid Body', component: RigidBodyExample},
  {id: 'physics-soft-body', name: 'Physics / Soft Body', component: SoftBodyExample},
  {id: 'physics-kinematics', name: 'Physics / Kinematics', component: KinematicsExample},
  {id: 'physics-collisions', name: 'Physics / Collision Events', component: CollisionEventExample}
]

class ExamplesApp extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      selectedExampleId: (location.hash && location.hash.replace(/^#/, '')) || EXAMPLES[0].id,
      bodyWidth: null,
      bodyHeight: null,
      stats: true
    }
    this._onBodyElRef = this._onBodyElRef.bind(this)
    this._onWindowResize = this._onWindowResize.bind(this)
    this._onHashChange = this._onHashChange.bind(this)
    this._onExampleSelect = this._onExampleSelect.bind(this)
    this._onToggleStats = this._onToggleStats.bind(this)
  }
  componentWillMount() {
    window.addEventListener('hashchange', this._onHashChange, false)
    window.addEventListener('resize', this._onWindowResize, false)
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this._onHashChange, false)
    window.removeEventListener('resize', this._onWindowResize, false)
  }

  _onBodyElRef(el) {
    this._bodyEl = el
    if (el) {
      this._onWindowResize()
    }
  }

  _onWindowResize() {
    let box = this._bodyEl.getBoundingClientRect()
    this.setState({bodyWidth: box.width, bodyHeight: box.height})
  }

  _onHashChange() {
    this.setState({
      selectedExampleId: location.hash.replace(/^#/, '')
    })
  }

  _onExampleSelect(e) {
    location.hash = EXAMPLES[e.target.selectedIndex].id
  }

  _onToggleStats() {
    this.setState({stats: !this.state.stats})
  }

  render() {
    let {selectedExampleId, bodyWidth, bodyHeight, stats} = this.state
    let example = EXAMPLES.filter(({id}) => id === selectedExampleId)[0]
    let ExampleCmp = example && example.component

    return (
      <div className="examples">
        <header className="examples_header">
          <h1>Troika Examples</h1>
          <select onChange={ this._onExampleSelect } value={this.state.selectedExampleId}>
            { EXAMPLES.map(example =>
              <option key={example.id} value={example.id}>{ example.name }</option>
            ) }
          </select>

          {this.props.vrButton && !example.disableVR ? (
            <span className="vr_button">{this.props.vrButton}</span>
          ) : null}

          <div className="stats_toggle">
            Show Stats <input type="checkbox" checked={stats} onChange={this._onToggleStats} />
          </div>

          <a href="https://github.com/protectwise/troika/tree/master/packages/troika-examples" className="repo_link">
            <img alt="GitHub" title="Sources on GitHub" src="./GitHub-Mark-64px.png" width={24} height={24} />
          </a>
        </header>
        <section className="examples_body" ref={ this._onBodyElRef }>
          { ExampleCmp ?
            (bodyWidth && bodyHeight ? <ExampleCmp width={ bodyWidth } height={ bodyHeight } stats={ stats } vr={!!this.props.vrDisplay} /> : null) :
            `Unknown example: ${selectedExampleId}`
          }
        </section>
      </div>
    )
  }
}

ExamplesApp = makeVrAware(ExamplesApp)

ReactDOM.render(<ExamplesApp />, document.getElementById('app'))
