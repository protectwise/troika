import { Object3DFacade } from "troika-3d";
import { BatchedText } from "troika-three-text";
import { TEXT_MESH_PROPS } from "./Text3DFacade";

export class BatchedText3DFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new BatchedText())

    // Non-renderable container for children so they don't end up in the scene
    this._texts = new Object3DFacade(this)
    this._texts.visible = false
  }

  afterUpdate() {
    TEXT_MESH_PROPS.forEach(prop => {
      this.threeObject[prop] = this[prop];
    })
    this._texts.children = this.children
    this._texts.afterUpdate()
    this._texts.forEachChild(text => this.threeObject.addText(text.threeObject))
    super.afterUpdate()
  }

  shouldUpdateChildren() {
    return false
  }
}
