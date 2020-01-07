import { utils } from 'troika-core'
import { CanvasTexture } from 'three'


const refireableEvents = [
  'onMouseOver',
  'onMouseOut',
  'onMouseMove',
  'onMouseDown',
  'onMouseUp',
  'onClick',
  'onDoubleClick'
]


/**
 * Create and return a higher-order facade class for a given facade class, that can render a
 * Troika sub-world (2D or 3D) into a Three.js `Texture` and supply that texture to
 * the facade. It can then be used by the facade for its own purposes, such as rendering
 * onto a 3D mesh.
 *
 * Pointer events will also be refired within the sub-world at the appropriate coordinates,
 * making the texture's contents interactive. This allows things like presenting a 2D user
 * interface that is mapped onto a 3D mesh.
 *
 * To configure the sub-world, define a `textureWorld` object on the facade's config. It
 * will work like any other facade config, and you'll need to set its `facade` property
 * to use either `World2DFacade` or `World3DFacade` as appropriate.
 *
 * @param {Facade} WrappedFacadeClass
 * @return {Facade}
 */
export function makeWorldTextureProvider(WrappedFacadeClass) {

  return class WorldTextureProvider extends WrappedFacadeClass {
    constructor(parent) {
      const texture = new CanvasTexture() //no canvas yet, will be added in first afterUpdate()
      super(parent, texture)
      this.worldTexture = texture

      // Wrap pointer events to both work as normal outer world events and also refire
      // in the inner world at their point on the surface texture
      const refire = this._refireAsInnerEvent.bind(this)
      refireableEvents.forEach(prop => {
        let userFn
        function wrapperFn(e) {
          refire(e)
          if (userFn) userFn.call(this, e)
        }

        // trigger initial registration of event handler
        this[prop] = wrapperFn

        // overwrite setter to just update the user-set function, and the getter
        // to always return the whole wrapper
        Object.defineProperty(this, prop, {
          set(val) {
            userFn = val
          },
          get() {
            return wrapperFn
          }
        })
      })
    }

    afterUpdate() {
      // Init the inner world if needed
      let innerWorld = this._worldFacade
      let newWorldConfig = this.textureWorld
      if (!innerWorld || !newWorldConfig || !(innerWorld instanceof newWorldConfig.facade)) {
        if (innerWorld) {
          innerWorld.onAfterRender = null
          innerWorld.destructor()
        }
        if (newWorldConfig) {
          // Replace the old canvas with a new one each time, since browsers will throw errors when
          // changing canvas context types/options
          this.worldTexture.dispose()
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 2
          this.worldTexture.image = canvas

          innerWorld = this._worldFacade = new newWorldConfig.facade(canvas)

          // Trigger texture update whenever the inner world is rerendered
          innerWorld.onAfterRender = () => {
            this.worldTexture.needsUpdate = true
            this.notifyWorld('needsRender')
          }
        }
      }

      // Update the inner world
      if (innerWorld) {
        innerWorld.renderingScheduler = this._getOuterWorld().renderingScheduler
        utils.assign(innerWorld, newWorldConfig)
        innerWorld.afterUpdate()
      }

      super.afterUpdate()
    }

    _refireAsInnerEvent(e) {
      const world = this._worldFacade
      if (world) {
        const uv = e.intersection && e.intersection.uv
        const x = uv ? Math.round(uv.x * world.width) : -1
        const y = uv ? Math.round((1 - uv.y) * world.height) : -1

        const nativeEvent = e.nativeEvent || e
        const innerEvent = document.createEvent('MouseEvents')
        innerEvent.initMouseEvent(
          nativeEvent.type, true, true, window, nativeEvent.detail, x, y, x, y, nativeEvent.ctrlKey,
          nativeEvent.altKey, nativeEvent.shiftKey, nativeEvent.metaKey, nativeEvent.button, null
        )
        this.worldTexture.image.dispatchEvent(innerEvent)
      }
    }

    _getOuterWorld() {
      let outerWorld = this
      while(outerWorld && !outerWorld.isWorld) {
        outerWorld = outerWorld.parent
      }
      return outerWorld
    }

    destructor() {
      const world = this._worldFacade
      if (world) {
        world.onAfterRender = null
        world.destructor()
      }
      this.worldTexture.dispose()
      super.destructor()
    }
  }

}





