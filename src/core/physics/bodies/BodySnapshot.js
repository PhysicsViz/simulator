/**
 * Serializable snapshot of a point body's editable physical and visual state.
 */
export class BodySnapshot {
  /**
   * @param {import('./PointBody.js').PointBody} body
   */
  constructor(body) {
    this.name = body.name;
    this.mass = body.mass;
    this.position = body.position.clone();
    this.velocity = body.velocity.clone();
    this.acceleration = body.acceleration.clone();
    this.visual = { ...body.visual };
    this.forces = body.forces.map((force) => force.clone());
  }

  /**
   * Restore this snapshot onto a body.
   * @param {import('./PointBody.js').PointBody} body
   */
  applyTo(body) {
    body.name = this.name;
    body.mass = this.mass;
    body.position = this.position.clone();
    body.velocity = this.velocity.clone();
    body.acceleration = this.acceleration.clone();
    body.visual = { ...this.visual };
    body.forces = this.forces.map((force) => force.clone());
    body.trajectory = [body.position.clone()];
  }
}
