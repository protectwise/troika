import React from 'react'
import {Group, Mesh, Line, BufferGeometry, BufferAttribute, CylinderGeometry, MeshLambertMaterial, LineBasicMaterial, DoubleSide} from 'three'
import {Object3DFacade, HtmlOverlay3DFacade} from 'troika-3d'
import Tooltip from './Tooltip.jsx'


const wallsGeometry = new CylinderGeometry(Math.sqrt(2) / 2, Math.sqrt(2) / 2, 1, 4, 1, true)
  .rotateY(Math.PI / 4)
  .rotateX(Math.PI / 2)
  .translate(0.5, 0.5, 0.5)

const wallsMaterial = new MeshLambertMaterial({
  color: 0x3ba7db,
  transparent: true,
  opacity: 0.5,
  side: DoubleSide
})


const wallsOutlineGeometry = new BufferGeometry()
wallsOutlineGeometry.setAttribute( 'position', new BufferAttribute(new Float32Array([
  0,0,1, 0,1,1, 1,1,1, 1,0,1, 0,0,1
]), 3))

const wallsOutlineMaterial = new LineBasicMaterial({
  color: 0x3ba7db,
  linewidth: 1
})

export default class Zone extends Object3DFacade {
  initThreeObject() {
    let group = new Group()

    // translucent walls
    let mesh = new Mesh(wallsGeometry, wallsMaterial)
    mesh.renderOrder = 20 //prevent occlusion of translucent Host meshes
    group.add(mesh)

    // bright outline around top of walls
    let outline = new Line(wallsOutlineGeometry, wallsOutlineMaterial)
    group.add(outline)

    return group
  }

  set width(w) {
    this.scaleX = w
  }
  get width() {
    return this.scaleX
  }

  set length(l) {
    this.scaleY = l
  }
  get length() {
    return this.scaleY
  }

  set height(h) {
    this.scaleZ = h
  }
  get height() {
    return this.scaleZ
  }

  set label(label) {
    if (label !== this._label) {
      if (label) {
        if (!this.children) {
          this.children = [{
            key: 'tooltip',
            facade: HtmlOverlay3DFacade,
            //center - will move along with transform of zone box:
            x: 0.5,
            y: 0.5,
            html: null //set by label setter
          }]
        }
        this.children[0].html = (
          <Tooltip text={ label } />
        )
      } else {
        this.children = null
      }
      this._label = label
    }
  }

/*
  afterUpdate() {
    let text = this.text
    text.text = 'Hello World'
    text.x = this.x + this.width / 2
    text.y = this.y + 10e-10
    text.z = this.height / 2
    text.rotateX = Math.PI / 2
    text.height = this.height
    text.afterUpdate()

    super.afterUpdate()
  }
*/

  destructor() {
    super.destructor()
    //this.text.destructor()
    // TODO dispose geometry/material?
  }
}
