import { Vector2 } from '../../math/Vector2.js';
import { Force } from './Force.js';

/**
 * Constant force with a fixed vector in newtons.
 */
export class ConstantForce extends Force {
  /**
   * @param {Vector2} vector Force vector in newtons.
   * @param {string} [label]
   */
  constructor(vector = Vector2.zero(), label = 'F') {
    super(label);
    this.vector = vector.clone();
  }

  getVector() {
    return this.vector.clone();
  }

  clone() {
    return new ConstantForce(this.vector, this.label);
  }
}
