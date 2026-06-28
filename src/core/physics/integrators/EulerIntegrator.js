import { Integrator } from './Integrator.js';

/**
 * Explicit Euler-style integrator using v = v + a dt, then r = r + v dt.
 */
export class EulerIntegrator extends Integrator {
  integrate(body, dt) {
    body.velocity = body.velocity.add(body.acceleration.scale(dt));
    body.position = body.position.add(body.velocity.scale(dt));
  }
}
