/**
 * VisionOS CSS and UI Presets for WebXR experiences
 *
 * VisionOS (and iPadOS) have specific requirements for spatial interactions:
 * - Safe area insets to prevent UI clipping by system chrome (grab bar, rounded corners)
 * - Overscroll behavior control to prevent rubber-banding on canvas
 * - Text size adjustment locks to maintain layout during window resize
 * - Cursor management for eye-gaze interaction feedback
 *
 * @module VisionOSPresets
 */

/**
 * Injects VisionOS-optimized CSS into the document
 * Call this once during app initialization for Vision Pro deployment
 *
 * CSS Features:
 * - Safe area environment variables to prevent chrome clipping
 * - Overscroll prevention for canvas interactions
 * - Fixed text size to prevent auto-inflation on resize
 * - Crosshair cursor for spatial interaction feedback
 *
 * @example
 * import { injectVisionOSStyles } from 'troika-xr'
 * injectVisionOSStyles()
 */
export function injectVisionOSStyles() {
  const styleId = 'troika-vision-os-styles'

  // Prevent duplicate injection
  if (document.getElementById(styleId)) {
    return
  }

  const stylesheet = document.createElement('style')
  stylesheet.id = styleId
  stylesheet.textContent = getVisionOSStylesheet()

  document.head.appendChild(stylesheet)
}

/**
 * Get the VisionOS stylesheet as a string
 * Useful for inline style tags or pre-rendering
 *
 * @returns {string} CSS content
 */
export function getVisionOSStylesheet() {
  return `
    /* VisionOS Safe Area Insets */
    /* Prevents UI elements from being clipped by system chrome (grab bar, rounded corners) */
    html, body {
      padding: env(safe-area-inset-top) env(safe-area-inset-right) 
               env(safe-area-inset-bottom) env(safe-area-inset-left);
      margin: 0;
      width: 100%;
      height: 100%;
    }

    /* Prevent rubber-banding on canvas interactions */
    /* Critical for drawing-based and gesture-based experiences */
    body {
      overscroll-behavior: none;
    }

    canvas {
      overscroll-behavior: none;
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Lock text size to prevent auto-inflation on window resize */
    /* VisionOS/iPadOS Safari auto-increases text size; this prevents layout break */
    html {
      -webkit-text-size-adjust: 100%;
    }

    /* Provide visual feedback for eye-gaze interaction */
    /* Changes cursor to crosshair when hovering interactive areas */
    canvas:hover {
      cursor: crosshair;
    }

    /* Remove default touch callout on long press */
    /* Prevents system menus from appearing during spatial interactions */
    canvas {
      -webkit-touch-callout: none;
    }

    /* Disable text selection during interactions */
    body {
      -webkit-user-select: none;
      user-select: none;
    }
  `
}

/**
 * Apply cursor style for spatial interaction feedback
 * Call when the canvas becomes interactive
 *
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {string} [cursorStyle='crosshair'] - CSS cursor value
 */
export function setCanvasCursorForVisionOS(canvas, cursorStyle = 'crosshair') {
  if (!canvas) return

  canvas.style.cursor = cursorStyle

  // Restore default cursor when interaction ends
  canvas.addEventListener('mouseleave', () => {
    canvas.style.cursor = 'auto'
  })
}

/**
 * Check if running on VisionOS
 * Useful for conditional VisionOS-specific code paths
 *
 * @returns {boolean} True if on VisionOS
 */
export function isVisionOS() {
  // VisionOS detection: Check for Vision Pro user agent markers
  const ua = navigator.userAgent

  return (
    /VisionOS/.test(ua) ||
    /Macintosh.*AppleWebKit.*Safari/.test(ua) && !/iPhone|iPad|iPod/.test(ua)
  )
}

/**
 * Check if running on iPadOS
 * Useful for conditional iPad-specific code paths
 *
 * @returns {boolean} True if on iPadOS
 */
export function isiPadOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/**
 * Get optimal framebuffer scale factor for VisionOS/iPadOS
 * Higher DPI displays benefit from aggressive scaling to maintain performance
 *
 * @param {XRSession} [xrSession] - Optional XR session for detection
 * @returns {number} Recommended framebuffer scale factor (0.5-1.0)
 *
 * @example
 * const scale = getOptimalFramebufferScale(xrSession)
 * // Use in: new XRWebGLLayer(xrSession, gl, { framebufferScaleFactor: scale })
 */
export function getOptimalFramebufferScale(xrSession) {
  if (isVisionOS()) {
    // Vision Pro: 1920×2160 per eye display
    // Use 90% of native resolution for best performance/quality balance
    return 0.9
  }

  if (isiPadOS()) {
    // iPad Pro M1/M2: High DPI, but less powerful than Vision Pro
    // Use 85% for smooth performance on high-end, 75% on standard iPad
    const isHighEnd = /iPad Pro/.test(navigator.userAgent)
    return isHighEnd ? 0.85 : 0.75
  }

  // Default: Use full resolution
  return 1.0
}

/**
 * Get safe area insets as a JS object
 * Useful for positioning UI elements programmatically
 *
 * @returns {Object} Object with { top, right, bottom, left } in pixels
 *
 * @example
 * const safeArea = getSafeAreaInsets()
 * canvas.style.top = safeArea.top + 'px'
 */
export function getSafeAreaInsets() {
  // CSS env() variables are only available in CSS context
  // Parse from computed styles or return defaults
  const root = document.documentElement
  const style = getComputedStyle(root)

  // These will return 'safe(0px)' or similar if not supported
  const top = parseEnvValue(style.getPropertyValue('--safe-area-inset-top')) || 0
  const right = parseEnvValue(style.getPropertyValue('--safe-area-inset-right')) || 0
  const bottom = parseEnvValue(style.getPropertyValue('--safe-area-inset-bottom')) || 0
  const left = parseEnvValue(style.getPropertyValue('--safe-area-inset-left')) || 0

  return { top, right, bottom, left }
}

/**
 * Helper: Parse CSS env() value to number
 * @private
 */
function parseEnvValue(value) {
  if (!value) return 0
  const match = value.match(/(\d+)px/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Presets for common VisionOS/iPad configurations
 */
export const VisionOSPresets = {
  /**
   * Full VisionOS optimization: All styles + framebuffer scaling
   * Recommended for Vision Pro-first applications
   */
  visionPro: {
    injectStyles: true,
    framebufferScale: 0.9,
    cursorStyle: 'crosshair',
    disableTextSelection: true
  },

  /**
   * iPad-optimized preset with safe areas and scaling
   * Recommended for cross-platform spatial apps
   */
  iPad: {
    injectStyles: true,
    framebufferScale: 0.8,
    cursorStyle: 'auto',
    disableTextSelection: true
  },

  /**
   * Desktop/browser fallback: Minimal styling
   * Used for development and testing
   */
  desktop: {
    injectStyles: false,
    framebufferScale: 1.0,
    cursorStyle: 'auto',
    disableTextSelection: false
  }
}

/**
 * Apply a preset configuration to the current environment
 *
 * @param {string|Object} preset - Preset name or custom config object
 *
 * @example
 * applyVisionOSPreset('visionPro')
 * // or
 * applyVisionOSPreset({ injectStyles: true, framebufferScale: 0.9 })
 */
export function applyVisionOSPreset(preset) {
  let config

  if (typeof preset === 'string') {
    config = VisionOSPresets[preset]
    if (!config) {
      console.warn(`Unknown VisionOS preset: "${preset}"`)
      return
    }
  } else {
    config = preset
  }

  if (config.injectStyles) {
    injectVisionOSStyles()
  }

  // Note: framebufferScale should be used during XRWebGLLayer creation
  // Store it on window for access in XR initialization
  if (config.framebufferScale !== undefined) {
    window.__troika_framebufferScale = config.framebufferScale
  }
}
