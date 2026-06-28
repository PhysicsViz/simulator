/**
 * Immutable-style two-dimensional vector used by the physics engine.
 * Components are expressed in SI units where applicable.
 */
export class Vector2 {
  /**
   * @param {number} x Horizontal component.
   * @param {number} y Vertical component.
   */
  constructor(x = 0, y = 0) {
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
  }

  /**
   * @param {Vector2} vector
   * @returns {Vector2}
   */
  add(vector) {
    return new Vector2(this.x + vector.x, this.y + vector.y);
  }

  /**
   * @param {Vector2} vector
   * @returns {Vector2}
   */
  subtract(vector) {
    return new Vector2(this.x - vector.x, this.y - vector.y);
  }

  /**
   * @param {number} scalar
   * @returns {Vector2}
   */
  scale(scalar) {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  /**
   * @param {Vector2} vector
   * @returns {number}
   */
  dot(vector) {
    return this.x * vector.x + this.y * vector.y;
  }

  /**
   * @returns {number} Euclidean magnitude.
   */
  norm() {
    return Math.hypot(this.x, this.y);
  }

  /**
   * @returns {Vector2} Unit vector, or the zero vector when the magnitude is zero.
   */
  normalize() {
    const length = this.norm();
    return length === 0 ? Vector2.zero() : this.scale(1 / length);
  }

  /**
   * @returns {Vector2}
   */
  clone() {
    return new Vector2(this.x, this.y);
  }

  /**
   * @returns {Vector2}
   */
  static zero() {
    return new Vector2(0, 0);
  }

  /**
   * @param {number} angleRadians Angle measured counter-clockwise from +x.
   * @param {number} magnitude Vector magnitude.
   * @returns {Vector2}
   */
  static fromAngle(angleRadians, magnitude = 1) {
    return new Vector2(Math.cos(angleRadians) * magnitude, Math.sin(angleRadians) * magnitude);
  }
}
