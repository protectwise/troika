import React from 'react'
import {Group, Mesh, Line, BufferGeometry, BufferAttribute, MeshLambertMaterial, LineBasicMaterial, DoubleSide} from 'three'
import {Object3D, Text, HtmlOverlay} from '../../src/index'
import Tooltip from './Tooltip.jsx'


const wallsGeometry = new BufferGeometry()
wallsGeometry.addAttribute( 'position', new BufferAttribute(new Float32Array([
  0,0,0, 1,0,0, 1,0,1,
  0,0,0, 0,0,1, 1,0,1,

  0,1,0, 1,1,0, 1,1,1,
  0,1,0, 0,1,1, 1,1,1,

  0,0,0, 0,1,0, 0,1,1,
  0,0,0, 0,0,1, 0,1,1,

  1,0,0, 1,1,0, 1,1,1,
  1,0,0, 1,0,1, 1,1,1
]), 3))

/*
const wall1Geometry = new PlaneGeometry(1, 1)
wall1Geometry.rotateY(Math.PI / 2)
wall1Geometry.translate(-.5, -.5, 0)
const wall2Geometry = new PlaneGeometry(1, 1)
wall2Geometry.rotateX(Math.PI / 2)
wall2Geometry.translate(.5, -.5, 1)
const wall3Geometry = new PlaneGeometry(1, 1)
wall3Geometry.rotateY(Math.PI / -2)
wall3Geometry.translate(-.5, .5, 1)
const wall4Geometry = new PlaneGeometry(1, 1)
wall4Geometry.rotateX(Math.PI / -2)
wall4Geometry.translate(-.5, -.5, 0)

const wallsGeometry = new Geometry()
wallsGeometry.merge(wall1Geometry)
wallsGeometry.merge(wall2Geometry)
wallsGeometry.merge(wall3Geometry)
wallsGeometry.merge(wall4Geometry)
*/


const wallsMaterial = new MeshLambertMaterial({
  color: 0x3ba7db,
  transparent: true,
  opacity: 0.5,
  side: DoubleSide
})


const wallsOutlineGeometry = new BufferGeometry()
wallsOutlineGeometry.addAttribute( 'position', new BufferAttribute(new Float32Array([
  0,0,1, 0,1,1, 1,1,1, 1,0,1, 0,0,1
]), 3))

const wallsOutlineMaterial = new LineBasicMaterial({
  color: 0x3ba7db,
  linewidth: 1
})

export default class Zone extends Object3D {
  constructor(parent) {
    let group = new Group()

    // translucent walls
    let mesh = new Mesh(wallsGeometry, wallsMaterial)
    mesh.renderOrder = 20 //prevent occlusion of translucent Host meshes
    group.add(mesh)

    // bright outline around top of walls
    let outline = new Line(wallsOutlineGeometry, wallsOutlineMaterial)
    group.add(outline)

    super(parent, group)

    // text label
    //this.text = new Text(this.parent)
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
            class: HtmlOverlay,
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
