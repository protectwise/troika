import {
  AmbientLight,
  Color,
  DirectionalLight,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  Scene,
  WebGPURenderer
} from 'three/webgpu'
import { color, mix, uv } from 'three/tsl'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Text } from 'troika-three-text/webgpu'

const FONTS = {
  display: 'https://fonts.gstatic.com/s/orbitron/v9/yMJRMIlzdpvBhQQL_Qq7dys.woff',
  body: 'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff'
}

// `?webgl` runs WebGPURenderer on its WebGL 2 backend instead.
const forceWebGL = new URLSearchParams(location.search).has('webgl')

const gradient = new MeshBasicNodeMaterial()
gradient.colorNode = mix(color(0xff6a3d), color(0x5dff8f), uv().x)

// One Text per feature, each captioned with what it shows.
const EXAMPLES = [
  { caption: 'fill', props: { text: 'Troika Text', font: FONTS.display, fontSize: 0.5, color: 0x9cff9c } },
  { caption: 'outlineWidth, outlineColor', props: { text: 'Outlined', font: FONTS.body, fontSize: 0.6, outlineWidth: 0.04, outlineColor: 0xff3b1f } },
  { caption: 'outlineBlur', props: { text: 'Glowing', font: FONTS.body, fontSize: 0.6, color: 0xd8ffd0, outlineWidth: 0.02, outlineBlur: 0.12, outlineColor: 0x39ff6a } },
  { caption: 'strokeWidth, fillOpacity: 0', props: { text: 'Stroked', font: FONTS.display, fontSize: 0.5, fillOpacity: 0, strokeWidth: 0.012, strokeColor: 0x6fd0ff } },
  { caption: 'curveRadius', props: { text: 'Curved Around', font: FONTS.body, fontSize: 0.55, color: 0x6fd0ff, curveRadius: 1.4 } },
  { caption: 'letterSpacing', props: { text: 'SPACED OUT', font: FONTS.body, fontSize: 0.5, color: 0xffb03a, letterSpacing: 0.2 } },
  { caption: 'maxWidth, textAlign', props: { text: 'Long text wraps to its maxWidth and each line is centered.', font: FONTS.body, fontSize: 0.34, maxWidth: 4, textAlign: 'center' } },
  { caption: 'styleRanges', props: { text: 'Rich text, in Orbitron', font: FONTS.body, fontSize: 0.45, styleRanges: { 0: { color: 0xff6a3d }, 5: { color: 0xffffff, size: 0.3, valign: 0.12 }, 12: { font: FONTS.display, color: 0x9cff9c } } } },
  { caption: 'MeshStandardNodeMaterial', material: new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.3 }), props: { text: 'Lit', font: FONTS.display, fontSize: 0.6 } },
  { caption: 'material colorNode', material: gradient, props: { text: 'Gradient', font: FONTS.display, fontSize: 0.55 } }
]

const renderer = new WebGPURenderer({ antialias: true, forceWebGL })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
document.body.appendChild(renderer.domElement)
await renderer.init()

const scene = new Scene()
scene.background = new Color(0x111418)
scene.add(new AmbientLight(0xffffff, 0.2))
const light = new DirectionalLight(0xffffff, 3)
light.position.set(-4, 3, 5)
scene.add(light)

const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 0, 14)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const COLUMNS = 2
const CELL = { x: 6, y: 2.2 }
const rows = Math.ceil(EXAMPLES.length / COLUMNS)

EXAMPLES.forEach(({ caption, props, material }, i) => {
  const x = ((i % COLUMNS) - (COLUMNS - 1) / 2) * CELL.x
  const y = ((rows - 1) / 2 - Math.floor(i / COLUMNS)) * CELL.y

  const text = new Text()
  Object.assign(text, { anchorX: 'center', anchorY: 'middle', color: 0xffffff }, props)
  if (material) text.material = material
  text.position.set(x, y + 0.15, 0)
  text.sync()
  scene.add(text)

  const label = new Text()
  label.text = caption
  label.fontSize = 0.16
  label.color = 0x6b7788
  label.anchorX = 'center'
  label.anchorY = 'top'
  label.position.set(x, y - 0.55, 0)
  label.sync()
  scene.add(label)
})

// Report the backend that actually ran: without WebGPU, WebGPURenderer falls back to WebGL 2.
const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2'
document.getElementById('info').innerHTML =
  `troika-three-text/webgpu on WebGPURenderer (${backend} backend) · ` +
  (forceWebGL ? '<a href="?">use WebGPU</a>' : '<a href="?webgl">force WebGL 2</a>') +
  ' · drag to orbit, scroll to zoom'

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
})
