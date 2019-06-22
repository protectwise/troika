import {ListFacade} from 'troika-core'
import {Group3DFacade} from 'troika-3d'
import Arc from './ArcFacade'



const TRANS = {
  duration: 700,
  easing: 'easeOutExpo',
  delay: 200
}


export default class ArcsFacade extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this._onArcMouseOver = this._onArcMouseOver.bind(this)
    this._onArcMouseOut = this._onArcMouseOut.bind(this)
  }
 
  afterUpdate() {
    this.children = [
      this._quadrantCfg('ne1', 0, 1),
      this._quadrantCfg('nw1', Math.PI / 2, 1),
      this._quadrantCfg('sw1', Math.PI, 1),
      this._quadrantCfg('se1', Math.PI * 3 / 2, 1),
      this._quadrantCfg('ne2', 0, 1.5),
      this._quadrantCfg('nw2', Math.PI / 2, 1.5),
      this._quadrantCfg('sw2', Math.PI, 1.5),
      this._quadrantCfg('se2', Math.PI * 3 / 2, 1.5)
    ]
    this.rotateX = this.angled ? -Math.PI / 4 : 0
    super.afterUpdate()
  }

  _onArcMouseOver(e) {
    this.highlightedArc = e.target.id
    this.afterUpdate()
  }

  _onArcMouseOut() {
    this.highlightedArc = null
    this.afterUpdate()
  }

  _quadrantCfg(key, baseAngle, baseRadius) {
    return {
      key: key,
      facade: ListFacade,
      data: (this.data && this.data[key]) || [],
      template: {
        key: d => d.id,
        facade: Arc,
        id: d => d.id,
        startAngle: d => baseAngle + d.startAngle,
        endAngle: d => baseAngle + d.endAngle,
        startRadius: baseRadius,
        scaleZ: this.arcDepth || 0.0001,
        highlight: d => d.id === this.highlightedArc,
        derivedLevel: () => this.derivedLevel || 0,
        wireframe: () => this.wireframe,
        onMouseOver: () => this._onArcMouseOver,
        onMouseOut: () => this._onArcMouseOut,
        animation: (d, i) => (d.isNew ? {
          from: {
            opacity: 0,
            endRadius: baseRadius + .01
          },
          to: {
            opacity: 1,
            endRadius: baseRadius + .3
          },
          duration: TRANS.duration,
          easing: TRANS.easing,
          delay: 200 + i * 50
        } : null),
        exitAnimation: {
          from: {
            opacity: 1,
            z: 0,
            endRadius: baseRadius + .3
          },
          to: {
            opacity: 0,
            z: this.angled ? -1 : 0,
            endRadius: baseRadius + (this.angled ? .3 : .01)
          },
          duration: 500,
          easing: TRANS.easing
        },
        transition: {
          startAngle: TRANS,
          endAngle: TRANS,
          scaleZ: TRANS
        }
      }
    }
  }

}