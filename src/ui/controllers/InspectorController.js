import { Vector2 } from '../../core/math/Vector2.js';
import { ConstantForce } from '../../core/physics/forces/ConstantForce.js';
import { GravityForce } from '../../core/physics/forces/GravityForce.js';

/**
 * Edits the selected point body's physical, visual and force properties.
 */
export class InspectorController {
  constructor({ elements, world, selectionController, onChange }) {
    this.elements = elements;
    this.world = world;
    this.selectionController = selectionController;
    this.onChange = onChange;
    this.isRendering = false;
    this.bind();
    this.selectionController.onChange(() => this.render());
  }

  bind() {
    this.elements.objectSelect.addEventListener('change', () => {
      this.selectionController.selectById(this.elements.objectSelect.value || null);
      this.onChange?.();
    });

    this.elements.bodyNameInput.addEventListener('input', () => {
      this.withSelected((body) => {
        body.name = this.elements.bodyNameInput.value.trim() || 'Object';
      });
    });

    this.bindNumericField(this.elements.bodyMassInput, (body, value) => {
      body.mass = Math.max(0.001, value);
    });
    this.bindNumericField(this.elements.bodyRadiusInput, (body, value) => {
      body.visual.radius = Math.max(3, value);
    });
    this.elements.bodyColorInput.addEventListener('input', () => {
      this.withSelected((body) => {
        body.visual.color = this.elements.bodyColorInput.value;
      }, false);
    });

    this.bindNumericField(this.elements.bodyPositionXInput, (body, value) => {
      body.position = new Vector2(value, body.position.y);
      body.trajectory = [body.position.clone()];
      body.saveInitialState();
    });
    this.bindNumericField(this.elements.bodyPositionYInput, (body, value) => {
      body.position = new Vector2(body.position.x, value);
      body.trajectory = [body.position.clone()];
      body.saveInitialState();
    });
    this.bindNumericField(this.elements.bodyVelocityXInput, (body, value) => {
      body.velocity = new Vector2(value, body.velocity.y);
      body.saveInitialState();
    });
    this.bindNumericField(this.elements.bodyVelocityYInput, (body, value) => {
      body.velocity = new Vector2(body.velocity.x, value);
      body.saveInitialState();
    });
    this.bindNumericField(this.elements.bodyAccelerationXInput, (body, value) => {
      body.acceleration = new Vector2(value, body.acceleration.y);
      body.saveInitialState();
    });
    this.bindNumericField(this.elements.bodyAccelerationYInput, (body, value) => {
      body.acceleration = new Vector2(body.acceleration.x, value);
      body.saveInitialState();
    });

    this.bindVisualToggle(this.elements.showPositionVectorCheckbox, 'showPositionVector');
    this.bindVisualToggle(this.elements.showVelocityVectorCheckbox, 'showVelocityVector');
    this.bindVisualToggle(this.elements.showAccelerationVectorCheckbox, 'showAccelerationVector');
    this.bindVisualToggle(this.elements.showForcesCheckbox, 'showForces');
    this.bindVisualToggle(this.elements.showTrajectoryCheckbox, 'showTrajectory');

    this.elements.addConstantForceBtn.addEventListener('click', () => {
      this.withSelected((body) => {
        const fx = this.parseNumber(this.elements.constantForceXInput.value, 0);
        const fy = this.parseNumber(this.elements.constantForceYInput.value, 0);
        body.addForce(new ConstantForce(new Vector2(fx, fy)));
        body.visual.showForces = true;
        body.saveInitialState();
      });
    });

    this.elements.addGravityForceBtn.addEventListener('click', () => {
      this.withSelected((body) => {
        body.addForce(new GravityForce());
        body.visual.showForces = true;
        body.saveInitialState();
      });
    });

    this.elements.clearForcesBtn.addEventListener('click', () => {
      this.withSelected((body) => {
        body.clearForces();
        body.saveInitialState();
      });
    });

    this.elements.deleteObjectBtn.addEventListener('click', () => {
      const body = this.selectionController.getSelectedBody();
      if (!body) {
        return;
      }
      this.world.removeBody(body.id);
      this.selectionController.clear();
      this.render();
      this.onChange?.();
    });
  }

  bindNumericField(element, apply) {
    element.addEventListener('change', () => {
      const value = Number.parseFloat(element.value);
      if (!Number.isFinite(value)) {
        this.render();
        return;
      }
      this.withSelected((body) => apply(body, value));
    });
  }

  bindVisualToggle(element, key) {
    element.addEventListener('change', () => {
      this.withSelected((body) => {
        body.visual[key] = element.checked;
        body.saveInitialState();
      }, false);
    });
  }

  withSelected(update, rerender = true) {
    if (this.isRendering) {
      return;
    }
    const body = this.selectionController.getSelectedBody();
    if (!body) {
      return;
    }
    update(body);
    body.saveInitialState();
    if (rerender) {
      this.render();
    }
    this.onChange?.();
  }

  render() {
    this.isRendering = true;
    const body = this.selectionController.getSelectedBody();
    this.renderObjectOptions(body);

    const hasSelection = Boolean(body);
    this.elements.noSelectionMessage.classList.toggle('hidden', hasSelection);
    this.elements.inspectorFields.classList.toggle('hidden', !hasSelection);
    this.elements.displayFields.classList.toggle('hidden', !hasSelection);
    this.elements.forceFields.classList.toggle('hidden', !hasSelection);
    this.elements.forceEmptyState.classList.toggle('hidden', hasSelection);

    if (body) {
      this.elements.bodyNameInput.value = body.name;
      this.elements.bodyMassInput.value = this.formatRaw(body.mass);
      this.elements.bodyRadiusInput.value = this.formatRaw(body.visual.radius);
      this.elements.bodyColorInput.value = body.visual.color;
      this.elements.bodyPositionXInput.value = this.formatRaw(body.position.x);
      this.elements.bodyPositionYInput.value = this.formatRaw(body.position.y);
      this.elements.bodyVelocityXInput.value = this.formatRaw(body.velocity.x);
      this.elements.bodyVelocityYInput.value = this.formatRaw(body.velocity.y);
      this.elements.bodyAccelerationXInput.value = this.formatRaw(body.acceleration.x);
      this.elements.bodyAccelerationYInput.value = this.formatRaw(body.acceleration.y);
      this.elements.showPositionVectorCheckbox.checked = body.visual.showPositionVector;
      this.elements.showVelocityVectorCheckbox.checked = body.visual.showVelocityVector;
      this.elements.showAccelerationVectorCheckbox.checked = body.visual.showAccelerationVector;
      this.elements.showForcesCheckbox.checked = body.visual.showForces;
      this.elements.showTrajectoryCheckbox.checked = body.visual.showTrajectory;
      this.elements.forceSummary.textContent = this.describeForces(body);
    }

    this.isRendering = false;
  }

  renderObjectOptions(selectedBody) {
    const select = this.elements.objectSelect;
    const selectedId = selectedBody?.id ?? '';
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = this.world.bodies.length ? 'Choose an object' : 'No objects';
    select.append(placeholder);

    for (const body of this.world.bodies) {
      const option = document.createElement('option');
      option.value = body.id;
      option.textContent = body.name;
      select.append(option);
    }

    select.value = selectedId;
  }

  describeForces(body) {
    if (!body.forces.length) {
      return 'No forces applied.';
    }
    return `${body.forces.length} force${body.forces.length === 1 ? '' : 's'} applied. Toggle "Use forces" to compute a = ΣF / m.`;
  }

  parseNumber(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  formatRaw(value) {
    return Number.parseFloat(value.toFixed(4)).toString();
  }
}
