import { Vector2 } from '../core/math/Vector2.js';
import { PointBody } from '../core/physics/bodies/PointBody.js';
import { GravityForce } from '../core/physics/forces/GravityForce.js';

/**
 * Create a free fall scene from rest with downward gravitational acceleration.
 * @param {import('../core/physics/world/PhysicsWorld.js').PhysicsWorld} world
 */
export function createFreeFallScene(world) {
  world.clear();
  world.useForces = false;
  const body = new PointBody({
    name: 'Free fall',
    mass: 1,
    position: new Vector2(0, 10),
    velocity: Vector2.zero(),
    acceleration: new Vector2(0, -9.81),
    visual: {
      color: '#fb7185',
      showForces: true
    }
  });
  body.addForce(new GravityForce());
  body.saveInitialState();
  world.addBody(body);
  return body;
}
