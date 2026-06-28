import { Integrator } from './Integrator.js';

/**
 * Kinematic integrator exact for constant acceleration during the time step.
 */
export class ConstantAccelerationIntegrator extends Integrator {
  integrate(body, dt) {
    body.position = body.position
      .add(body.velocity.scale(dt))
      .add(body.acceleration.scale(0.5 * dt * dt));
    body.velocity = body.velocity.add(body.acceleration.scale(dt));
  }
}
