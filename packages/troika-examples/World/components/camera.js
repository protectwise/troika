import { PerspectiveCamera } from 'three';

function createCamera() {
  const camera = new PerspectiveCamera(
    35, // fov = Field Of View
    1, // aspect ratio (dummy value)
    0.01, // near clipping plane
    100, // far clipping plane
  );

  // move the camera back so we can view the scene
  camera.position.set(5, 0, -10);
  camera.lookAt(0,0,0)

  camera.tick = (delta,elapsedTime) => {
    let x = Math.sin(elapsedTime/5)*10
    let z = Math.cos(elapsedTime/5)*10
    let y = 0
    camera.position.set(x,y,z)
    camera.lookAt(0,0,0)
  }

  return camera;
}

export { createCamera };
