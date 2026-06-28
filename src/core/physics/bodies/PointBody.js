import { AppConfig } from '../../../app/AppConfig.js';
import { Vector2 } from '../../math/Vector2.js';
import { BodySnapshot } from './BodySnapshot.js';

let nextBodyId = 1;

/**
 * Physical point mass. The visual radius and color are rendering metadata only
 * and never participate in the physics calculations.
 */
export class PointBody {
  /**
   * @param {object} options
   * @param {string} [options.id]
   * @param {string} [options.name]
   * @param {number} [options.mass] Mass in kilograms.
   * @param {Vector2} [options.position] Position in meters.
   * @param {Vector2} [options.velocity] Velocity in meters per second.
   * @param {Vector2} [options.acceleration] Acceleration in meters per second squared.
   * @param {object} [options.visual] Rendering-only visual properties.
   */
  constructor({
    id = `body-${nextBodyId++}`,
    name = 'Object',
    mass = AppConfig.bodies.defaultMass,
    position = Vector2.zero(),
    velocity = Vector2.zero(),
    acceleration = Vector2.zero(),
    visual = {}
  } = {}) {
    this.id = id;
    this.name = name;
    this.mass = Math.max(0.001, mass);
    this.position = position.clone();
    this.velocity = velocity.clone();
    this.acceleration = acceleration.clone();
    this.forces = [];
    this.trajectory = [this.position.clone()];
    this.visual = {
      ...AppConfig.bodies.defaultVisual,
      ...visual
    };
    this.initialState = null;
    this.saveInitialState();
  }

  /**
   * Store the current state for later reset.
   */
  saveInitialState() {
    this.initialState = new BodySnapshot(this);
  }

  /**
   * Restore the saved initial state.
   */
  reset() {
    if (this.initialState) {
      this.initialState.applyTo(this);
      return;
    }
    this.trajectory = [this.position.clone()];
  }

  /**
   * @param {import('../forces/Force.js').Force} force
   */
  addForce(force) {
    this.forces.push(force);
  }

  clearForces() {
    this.forces = [];
  }

  /**
   * Append the current position to the rendered trajectory.
   */
  addTrajectoryPoint() {
    const last = this.trajectory[this.trajectory.length - 1];
    if (!last || this.position.subtract(last).norm() > 0.015) {
      this.trajectory.push(this.position.clone());
    }
    if (this.trajectory.length > AppConfig.trajectory.maxPoints) {
      this.trajectory.splice(0, this.trajectory.length - AppConfig.trajectory.maxPoints);
    }
  }
}
