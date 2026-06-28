/**
 * Base class for forces applied to a point body.
 */
export class Force {
  constructor(label = 'F') {
    this.label = label;
  }

  /**
   * @param {import('../bodies/PointBody.js').PointBody} _body
   * @returns {import('../../math/Vector2.js').Vector2} Force vector in newtons.
   */
  getVector(_body) {
    throw new Error('Force.getVector must be implemented by subclasses.');
  }

  /**
   * @returns {Force}
   */
  clone() {
    throw new Error('Force.clone must be implemented by subclasses.');
  }
}
