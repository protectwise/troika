import React from 'react'
import T from 'prop-types'
import {Canvas3D} from 'troika-3d'
import {injectVisionOSStyles, isVisionOS, isiPadOS} from 'troika-xr'
import {ExampleConfigurator} from '../_shared/ExampleConfigurator.js'

/**
 * Vision Pro Optimized Interactive Spheres Example
 *
 * This example demonstrates how to create a WebXR application that works optimally
 * on Apple Vision Pro. It includes:
 *
 * - VisionOS-specific CSS optimizations (safe area insets, overscroll prevention, etc.)
 * - Interactive 3D scene with rotating sphere groups
 * - Responsive UI design that works with spatial interaction (eye-gaze + pinch)
 * - Support for both Vision Pro and standard WebXR experiences
 *
 * Key Vision Pro features:
 * - Safe area environment variables prevent UI clipping by system chrome
 * - Cursor feedback for eye-gaze interaction
 * - Touch interaction prevention (prevents spurious system menus)
 */
class VisionProUIExample extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      rotateX: 0,
      rotateY: 0.5,
      rotateZ: 0,
      scale: 1.5,
      spacing: 1.2,
      sphereSize: 0.8,
      color1: '#ff6b6b',
      color2: '#4ecdc4',
      color3: '#45b7d1',
      color4: '#f7b731',
      wireframe: false,
      isVisionOS: isVisionOS(),
      isiPadOS: isiPadOS()
    }

    this._onMouseMove = this._onMouseMove.bind(this)
    this._onStateUpdate = this._onStateUpdate.bind(this)
  }

  componentDidMount() {
    // Inject VisionOS CSS optimizations on mount
    // This includes safe area insets, overscroll prevention, text-size-adjust, and cursor feedback
    if (this.state.isVisionOS || this.state.isiPadOS) {
      injectVisionOSStyles()
    }
  }

  _onMouseMove(e) {
    const rect = this._canvasContainer && this._canvasContainer.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Only update rotation if mouse is over canvas
    if (x > 0 && x < rect.width && y > 0 && y < rect.height) {
      this.setState({
        rotateX: Math.PI / 3 * (y / rect.height * 2 - 1),
        rotateY: Math.PI * (x / rect.width * 2 - 1)
      })
    }
  }

  _onStateUpdate(newState) {
    this.setState(newState)
  }

  _parseColor(colorStr) {
    if (typeof colorStr === 'string') {
      return parseInt(colorStr.replace('#', ''), 16)
    }
    return colorStr
  }

  render() {
    const {
      rotateX, rotateY, rotateZ, scale, spacing, sphereSize,
      color1, color2, color3, color4, wireframe, isVisionOS, isiPadOS
    } = this.state

    const platformLabel = isVisionOS ? 'Vision Pro' : (isiPadOS ? 'iPadOS' : 'Desktop WebXR')

    return (
      <div
        ref={el => this._canvasContainer = el}
        style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column'}}
        onMouseMove={this._onMouseMove}
      >
        <Canvas3D
          antialias
          style={{flex: 1}}
          stats={this.props.stats}
          camera={{
            x: 0,
            y: 0,
            z: 5,
            lookAt: {x: 0, y: 0, z: 0}
          }}
          lights={[
            {type: 'ambient', color: 0xffffff, intensity: 0.6},
            {type: 'directional', color: 0xffffff, x: 1, y: 1, z: 1, intensity: 0.8},
            {type: 'directional', color: 0xffffff, x: -1, y: -1, z: -1, intensity: 0.3}
          ]}
          objects={[
            // Central rotating sphere group
            {
              key: 'group',
              facade: 'Group3D',
              rotateX: rotateX,
              rotateY: rotateY,
              rotateZ: rotateZ,
              scaleX: scale,
              scaleY: scale,
              scaleZ: scale,
              children: [
                // Sphere 1 - Front Right
                {
                  key: 'sphere1',
                  facade: 'Sphere',
                  radius: sphereSize,
                  x: spacing,
                  y: spacing,
                  z: 0,
                  wireframe: wireframe,
                  material: {
                    color: this._parseColor(color1),
                    metalness: 0.3,
                    roughness: 0.4,
                    castShadow: true,
                    receiveShadow: true
                  }
                },
                // Sphere 2 - Front Left
                {
                  key: 'sphere2',
                  facade: 'Sphere',
                  radius: sphereSize,
                  x: -spacing,
                  y: spacing,
                  z: 0,
                  wireframe: wireframe,
                  material: {
                    color: this._parseColor(color2),
                    metalness: 0.3,
                    roughness: 0.4,
                    castShadow: true,
                    receiveShadow: true
                  }
                },
                // Sphere 3 - Back Right
                {
                  key: 'sphere3',
                  facade: 'Sphere',
                  radius: sphereSize,
                  x: spacing,
                  y: -spacing,
                  z: 0,
                  wireframe: wireframe,
                  material: {
                    color: this._parseColor(color3),
                    metalness: 0.3,
                    roughness: 0.4,
                    castShadow: true,
                    receiveShadow: true
                  }
                },
                // Sphere 4 - Back Left
                {
                  key: 'sphere4',
                  facade: 'Sphere',
                  radius: sphereSize,
                  x: -spacing,
                  y: -spacing,
                  z: 0,
                  wireframe: wireframe,
                  material: {
                    color: this._parseColor(color4),
                    metalness: 0.3,
                    roughness: 0.4,
                    castShadow: true,
                    receiveShadow: true
                  }
                },
                // Central sphere
                {
                  key: 'centerSphere',
                  facade: 'Sphere',
                  radius: sphereSize * 0.6,
                  x: 0,
                  y: 0,
                  z: 0,
                  wireframe: wireframe,
                  material: {
                    color: 0xffffff,
                    metalness: 0.6,
                    roughness: 0.2,
                    castShadow: true,
                    receiveShadow: true
                  }
                }
              ]
            },
            // Configuration UI
            {
              key: 'config',
              isXR: !!this.props.xrSession,
              facade: ExampleConfigurator,
              data: this.state,
              onUpdate: this._onStateUpdate,
              items: [
                {type: 'range', path: 'rotateX', label: 'Rotation X', min: -Math.PI, max: Math.PI, step: 0.01},
                {type: 'range', path: 'rotateY', label: 'Rotation Y', min: -Math.PI, max: Math.PI, step: 0.01},
                {type: 'range', path: 'rotateZ', label: 'Rotation Z', min: -Math.PI, max: Math.PI, step: 0.01},
                {type: 'range', path: 'scale', label: 'Scale', min: 0.5, max: 2, step: 0.1},
                {type: 'range', path: 'spacing', label: 'Spacing', min: 0.5, max: 3, step: 0.1},
                {type: 'range', path: 'sphereSize', label: 'Sphere Size', min: 0.3, max: 1.5, step: 0.1},
                {type: 'color', path: 'color1', label: 'Color 1'},
                {type: 'color', path: 'color2', label: 'Color 2'},
                {type: 'color', path: 'color3', label: 'Color 3'},
                {type: 'color', path: 'color4', label: 'Color 4'},
                {type: 'boolean', path: 'wireframe', label: 'Wireframe'}
              ]
            }
          ]}
        />

        {/* Vision Pro Info Panel */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          padding: '12px 16px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          maxWidth: '300px',
          zIndex: 100,
          pointerEvents: 'none'
        }}>
          <div><strong>Platform:</strong> {platformLabel}</div>
          <div><strong>VisionOS Styles:</strong> {isVisionOS || isiPadOS ? 'Applied ✓' : 'Not Applicable'}</div>
          <div style={{marginTop: '8px', fontSize: '11px', opacity: 0.8}}>
            {isVisionOS && (
              <>
                <div>✓ Safe area insets enabled</div>
                <div>✓ Overscroll prevention active</div>
                <div>✓ Text size locked</div>
                <div>✓ Cursor feedback enabled</div>
              </>
            )}
            {isiPadOS && !isVisionOS && (
              <>
                <div>✓ iPad optimizations applied</div>
                <div>✓ Safe area insets enabled</div>
                <div>✓ Overscroll prevention active</div>
              </>
            )}
            {!isVisionOS && !isiPadOS && (
              <div>Desktop/Standard WebXR mode</div>
            )}
          </div>
        </div>
      </div>
    )
  }
}

VisionProUIExample.propTypes = {
  width: T.number,
  height: T.number,
  stats: T.bool,
  xrSession: T.object,
  xrSessionMode: T.string,
  xrReferenceSpace: T.object
}

export default VisionProUIExample

