/**
 * Live numerical panel for the selected point body.
 * This class is intentionally structured so plotted graphs can be added later.
 */
export class GraphPanel {
  constructor({ elements, world, selectionController }) {
    this.elements = elements;
    this.world = world;
    this.selectionController = selectionController;
  }

  render() {
    const body = this.selectionController.getSelectedBody();
    if (!body) {
      this.setEmpty();
      return;
    }

    this.elements.valueTime.textContent = `${this.world.time.toFixed(2)} s`;
    this.elements.valuePosition.textContent = `${this.format(body.position.x)}, ${this.format(body.position.y)} m`;
    this.elements.valueVelocity.textContent = `${this.format(body.velocity.x)}, ${this.format(body.velocity.y)} m/s`;
    this.elements.valueAcceleration.textContent = `${this.format(body.acceleration.x)}, ${this.format(body.acceleration.y)} m/s²`;
    this.elements.valueSpeed.textContent = `${this.format(body.velocity.norm())} m/s`;
    this.elements.valueAccelerationMagnitude.textContent = `${this.format(body.acceleration.norm())} m/s²`;
  }

  setEmpty() {
    this.elements.valueTime.textContent = '—';
    this.elements.valuePosition.textContent = '—';
    this.elements.valueVelocity.textContent = '—';
    this.elements.valueAcceleration.textContent = '—';
    this.elements.valueSpeed.textContent = '—';
    this.elements.valueAccelerationMagnitude.textContent = '—';
  }

  format(value) {
    return value.toFixed(2);
  }
}
