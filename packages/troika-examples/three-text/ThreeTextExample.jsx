import {
  BoxBufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import {Text} from 'troika-three-text'

const ThreeTextExample = () => {
  // Get a reference to the container element that will hold our scene
  const container = document.body;

  // create a Scene
  const scene = new Scene();

  // Set the background color
  scene.background = new Color('skyblue');

  // Create a camera
  const fov = 35; // AKA Field of View
  const aspect = container.clientWidth / container.clientHeight;
  const near = 0.1; // the near clipping plane
  const far = 100; // the far clipping plane

  const camera = new PerspectiveCamera(fov, aspect, near, far);

  // every object is initially created at ( 0, 0, 0 )
  // move the camera back so we can view the scene
  camera.position.set(0, 0, 10);

  const myText = new Text()
  scene.add(myText)

  // Set properties to configure:
  myText.text = 'Hello world!'
  myText.fontSize = 0.2
  myText.position.z = -2
  myText.color = 0x9966FF

  // Update the rendering:
  myText.sync()

  // create the renderer
  const renderer = new WebGLRenderer();

  // next, set the renderer to the same size as our container element
  renderer.setSize(container.clientWidth, container.clientHeight);

  // finally, set the pixel ratio so that our scene will look good on HiDPI displays
  renderer.setPixelRatio(window.devicePixelRatio);

  // add the automatically created <canvas> element to the page
  container.append(renderer.domElement);

  // render, or 'create a still image', of the scene
  renderer.render(scene, camera);
} 

export default ThreeTextExample