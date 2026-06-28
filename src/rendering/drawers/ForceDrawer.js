/**
 * Draws applied force vectors for a body.
 */
export class ForceDrawer {
  /**
   * @param {import('./VectorDrawer.js').VectorDrawer} vectorDrawer
   */
  constructor(vectorDrawer) {
    this.vectorDrawer = vectorDrawer;
  }

  draw(ctx, camera, body, style) {
    for (const force of body.forces) {
      const vector = force.getVector(body).scale(style.vectors.forceScale);
      this.vectorDrawer.drawVector(ctx, camera, body.position, vector, {
        color: style.colors.forceVector,
        label: force.label ?? 'F',
        lineWidth: 2.2
      }, style);
    }
  }
}
