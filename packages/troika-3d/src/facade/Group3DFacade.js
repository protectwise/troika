import {Group} from 'three'
import Object3DFacade from './Object3DFacade.js'


export default class Group3DFacade extends Object3DFacade {
  constructor(parent) {
    let group = new Group()
    group.isRenderable = false //trigger optimizations
    super(parent, group)
  }
}
