import {Group as ThreeGroup} from 'three'
import Object3D from './Object3D'


export default class Group extends Object3D {
  constructor(parent) {
    super(parent, new ThreeGroup())
  }
}
