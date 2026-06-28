import { Vector2 } from '../core/math/Vector2.js';
import { PointBody } from '../core/physics/bodies/PointBody.js';
import { GravityForce } from '../core/physics/forces/GravityForce.js';

/**
 * Create a projectile launched from the origin at 20 m/s and 45 degrees.
 * @param {import('../core/physics/world/PhysicsWorld.js').PhysicsWorld} world
 */
export function createProjectileScene(world) {
  world.clear();
  world.useForces = false;
  const speed = 20;
  const angle = Math.PI / 4;
  const body = new PointBody({
    name: 'Projectile',
    mass: 1,
    position: new Vector2(0, 0),
    velocity: Vector2.fromAngle(angle, speed),
    acceleration: new Vector2(0, -9.81),
    visual: {
      color: '#38bdf8',
      showForces: true
    }
  });
  body.addForce(new GravityForce());
  body.saveInitialState();
  world.addBody(body);
  return body;
}
