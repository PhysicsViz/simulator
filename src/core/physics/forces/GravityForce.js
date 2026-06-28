import { Vector2 } from '../../math/Vector2.js';
import { Force } from './Force.js';

/**
 * Near-Earth gravitational force, pointing downward in the physics coordinate system.
 */
export class GravityForce extends Force {
  /**
   * @param {number} [g] Gravitational field strength in m/s².
   */
  constructor(g = 9.81) {
    super('F');
    this.g = g;
  }

  /**
   * @param {import('../bodies/PointBody.js').PointBody} body
   */
  getVector(body) {
    return new Vector2(0, -body.mass * this.g);
  }

  clone() {
    return new GravityForce(this.g);
  }
}
