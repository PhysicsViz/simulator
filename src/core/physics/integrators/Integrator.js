/**
 * Base class for numerical integrators.
 */
export class Integrator {
  /**
   * Advance one body by a time step.
   * @param {import('../bodies/PointBody.js').PointBody} _body
   * @param {number} _dt Time step in seconds.
   */
  integrate(_body, _dt) {
    throw new Error('Integrator.integrate must be implemented by subclasses.');
  }
}
