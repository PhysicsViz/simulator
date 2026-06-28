import { Vector2 } from '../../math/Vector2.js';

/**
 * Sums all forces applied to a point body.
 */
export class ResultantForceCalculator {
  /**
   * @param {import('../bodies/PointBody.js').PointBody} body
   * @returns {Vector2} Resultant force in newtons.
   */
  calculate(body) {
    return body.forces.reduce((result, force) => result.add(force.getVector(body)), Vector2.zero());
  }
}
