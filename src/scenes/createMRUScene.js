import { Vector2 } from '../core/math/Vector2.js';
import { PointBody } from '../core/physics/bodies/PointBody.js';

/**
 * Create a uniform linear motion scene: constant velocity, zero acceleration.
 * @param {import('../core/physics/world/PhysicsWorld.js').PhysicsWorld} world
 */
export function createMRUScene(world) {
  world.clear();
  world.useForces = false;
  const body = new PointBody({
    name: 'MRU particle',
    mass: 1,
    position: new Vector2(-6, 1.5),
    velocity: new Vector2(3.2, 0),
    acceleration: Vector2.zero(),
    visual: {
      color: '#22c55e',
      showAccelerationVector: false,
      showForces: false
    }
  });
  body.saveInitialState();
  world.addBody(body);
  return body;
}
