/**
 * Generate an SDF texture image for a single glyph path, placing the result into a webgl canvas at a
 * given location and channel. Utilizes the webgl-sdf-generator external package for GPU-accelerated SDF
 * generation when supported.
 */
export function generateSDF(width: any, height: any, path: any, viewBox: any, distance: any, exponent: any, canvas: any, x: any, y: any, channel: any, useWebGL?: boolean): any;
export function warmUpSDFCanvas(canvas: any): void;
export const resizeWebGLCanvasWithoutClearing: any;
