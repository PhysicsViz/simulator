import { ResultantForceCalculator } from '../forces/ResultantForceCalculator.js';
import { ConstantAccelerationIntegrator } from '../integrators/ConstantAccelerationIntegrator.js';

/**
 * Owns point bodies, simulation time and integration rules.
 */
export class PhysicsWorld {
  constructor({
    integrator = new ConstantAccelerationIntegrator(),
    forceCalculator = new ResultantForceCalculator(),
    useForces = false
  } = {}) {
    this.bodies = [];
    this.time = 0;
    this.integrator = integrator;
    this.forceCalculator = forceCalculator;
    this.useForces = useForces;
  }

  /**
   * @param {import('../bodies/PointBody.js').PointBody} body
   * @returns {import('../bodies/PointBody.js').PointBody}
   */
  addBody(body) {
    this.bodies.push(body);
    return body;
  }

  /**
   * @param {string} id
   */
  removeBody(id) {
    this.bodies = this.bodies.filter((body) => body.id !== id);
  }

  /**
   * @param {string} id
   * @returns {import('../bodies/PointBody.js').PointBody | undefined}
   */
  getBodyById(id) {
    return this.bodies.find((body) => body.id === id);
  }

  /**
   * Advance the world by dt seconds.
   * @param {number} dt
   */
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    for (const body of this.bodies) {
      if (this.useForces) {
        const resultant = this.forceCalculator.calculate(body);
        body.acceleration = resultant.scale(1 / body.mass);
      }
      this.integrator.integrate(body, dt);
      body.addTrajectoryPoint();
    }

    this.time += dt;
  }

  reset() {
    this.time = 0;
    for (const body of this.bodies) {
      body.reset();
    }
  }

  clear() {
    this.bodies = [];
    this.time = 0;
  }
}
