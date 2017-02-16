import {Group} from 'three'
import Object3DFacade from './Object3D'


export default class Group3DFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new Group())
  }
}
