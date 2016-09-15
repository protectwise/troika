import _ from 'lodash'
import THREE from 'three'
import Parent from './Parent'
import Scene from './Scene'
import Camera from './Camera'
import {MOUSE_EVENT_PROPS} from './Object3D'


const raycaster = new THREE.Raycaster()


class World extends Parent {
  constructor(canvas, threeJsRendererConfig) {
    super(null)

    this.width = this.height = 500

    this._threeRenderer = new THREE.WebGLRenderer(_.assign({
      canvas: canvas
    }, threeJsRendererConfig))
  }

  set backgroundColor(color) {
    if (color !== this._bgColor) {
      this._threeRenderer.setClearColor(new THREE.Color(color))
      this._bgColor = color
    }
  }
  get backgroundColor() {
    return this._bgColor
  }


  afterUpdate() {
    let {camera, scene, width, height} = this
    camera.key = 'camera'
    camera.class = camera.class || Camera
    scene.key = 'scene'
    scene.class = scene.class || Scene
    this.children = [camera, scene]

    super.afterUpdate()

    let renderer = this._threeRenderer

    let pixelRatio = window.devicePixelRatio
    if (renderer.getPixelRatio() !== pixelRatio) {
      renderer.setPixelRatio(pixelRatio)
    }

    let lastSize = renderer.getSize()
    if (lastSize.width !== width || lastSize.height !== height) {
      renderer.setSize(width, height, true)
    }

    this.requestRender()
  }

  // Requests a ThreeJS render pass. If one has already been done this frame, queue up a render on
  // the next frame; otherwise do it immediately.
  requestRender() {
    if (this._hasRenderedThisFrame) {
      this._needsRenderNextFrame = true
    } else {
      this._threeRenderer.render(this.getChildByKey('scene').threeObject, this.getChildByKey('camera').threeObject)
      this._hasRenderedThisFrame = true
    }
    if (!this._renderNextFrameTimer) {
      this._renderNextFrameTimer = requestAnimationFrame(() => {
        this._renderNextFrameTimer = null
        this._hasRenderedThisFrame = false
        if (this._needsRenderNextFrame) {
          this.requestRender()
        }
        this._needsRenderNextFrame = false
      })
    }
  }


  onNotify(source, message, data) {
    switch(message) {
      case 'needsRender':
        this.requestRender()
        break
      case 'addEventListener':
        let registry = this.$eventRegistry || (this.$eventRegistry = Object.create(null))
        let listeners = registry[data.type] || (registry[data.type] = Object.create(null))
        listeners[source.$facadeId] = data.handler
        break
      case 'removeEventListener':
        listeners = this.$eventRegistry[data.type]
        if (listeners) {
          delete listeners[source.$facadeId]
          if (_.isEmpty(listeners)) {
            delete this.$eventRegistry[data.type]
          }
        }
        break
    }
  }

  handleMouseMove(e) {
    let registry = this.$eventRegistry
    if (registry && (registry.onMouseOver || registry.onMouseOut)) {
      let lastHovered = this.$hoveredFacade
      let hovered = this.$hoveredFacade = this.findHoveredFacade(e)
      if (hovered !== lastHovered && registry) {
        if (lastHovered) {
          let handler = registry.onMouseOut && registry.onMouseOut[lastHovered.$facadeId]
          if (handler) {
            e = _.clone(e)
            e.target = e.currentTarget = lastHovered
            e.relatedTarget = hovered || null
            handler(e)
          }
        }
        if (hovered) {
          let handler = registry.onMouseOver && registry.onMouseOver[hovered.$facadeId]
          if (handler) {
            e = _.clone(e)
            e.target = e.currentTarget = hovered
            e.relatedTarget = lastHovered || null
            handler(e)
          }
        }
      }
    }
  }

  handleClick(e) {
    var handler
    let registry = this.$eventRegistry
    if (registry && registry.onClick) {
      let clicked = this.findHoveredFacade(e)
      if (!clicked) {
        clicked = this.getChildByKey('scene')
        handler = clicked.onClick
      } else {
        handler = registry.onClick && registry.onClick[clicked.$facadeId]
      }
      if (handler) {
        e = _.clone(e)
        e.target = e.currentTarget = clicked
        handler(e)
      }
    }
  }

  findHoveredFacade(e) {
    // convert mouse position to normalized device coords (-1 to 1)
    let canvasRect = e.target.getBoundingClientRect()
    let coords = new THREE.Vector2(
      (e.clientX - canvasRect.left) / canvasRect.width * 2 - 1,
      (e.clientY - canvasRect.top) / canvasRect.height * -2 + 1
    )

    // ensure camera's matrix is updated
    let camera = this.getChildByKey('camera').threeObject
    camera.updateMatrixWorld()

    // prep raycaster
    raycaster.setFromCamera(coords, camera)

    // Find intersecting objects; the first item returned should be the closest to the camera
    var allHovered = raycaster.intersectObjects(this.getChildByKey('scene').threeObject.children, true)
    for (let i = 0; i < allHovered.length; i++) {
      let nearest3Obj = allHovered[i]
      nearest3Obj = nearest3Obj && nearest3Obj.object
      // Find the object's facade - the nearest threejs parent with a $facade pointer
      let nearestFacade
      while (nearest3Obj) {
        nearestFacade = nearest3Obj.$facade
        // By default only facades with a mouse event listener assigned will be counted, to prevent being blocked by unwanted objects
        // If an object should definitely block events from objects behind it, set `pointerEvents:true`
        // If an object has one of the mouse event properties but should be ignored in raycasting, set `pointerEvents:false`
        if (nearestFacade && nearestFacade.pointerEvents !== false && (nearestFacade.pointerEvents || MOUSE_EVENT_PROPS.some(e => nearestFacade[e]))) {
          return nearestFacade
        }
        nearest3Obj = nearest3Obj.parent
      }
    }
    return null
  }

  destructor() {
    if (this._renderNextFrameTimer) {
      cancelAnimationFrame(this._renderNextFrameTimer)
    }
    delete this._renderNextFrameTimer
  }

}



export default World
