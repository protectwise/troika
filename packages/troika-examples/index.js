import { World } from './World/World.js';

function main() {
  // Get a reference to the container element
  const container = document.getElementById('app');

  // create a new world
  const world = new World(container);

  // start the animation loop
  world.start();
}

main();
