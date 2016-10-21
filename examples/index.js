import React from 'react'
import ReactDOM from 'react-dom'
import CityGrid from './citygrid/CityGrid'
import ShaderAnim from './shader-anim/ShaderAnim'


const EXAMPLES = [
  {id: 'citygrid', name: 'City', component: CityGrid},
  {id: 'shaderanim', name: 'Animated Shaders', component: ShaderAnim}
]

const ExamplesApp = React.createClass({
  componentWillMount() {
    window.addEventListener('hashchange', this._onHashChange, false)
  },

  getInitialState() {
    return {
      selectedExampleId: (location.hash && location.hash.replace(/^#/, '')) || EXAMPLES[0].id
    }
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
    let {selectedExampleId} = this.state
    let example = EXAMPLES.filter(({id}) => id === selectedExampleId)[0]

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
        <section className="examples_body">
          { example ?
            React.createElement(example.component) :
            `Unknown example: ${selectedExampleId}`
          }
        </section>
      </div>
    )
  }
})

ReactDOM.render(<ExamplesApp />, document.body)
