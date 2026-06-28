/**
 * Binds top-level simulation controls to application callbacks.
 */
export class SimulationControlsController {
  constructor({ elements, callbacks }) {
    this.elements = elements;
    this.callbacks = callbacks;
    this.bind();
  }

  bind() {
    this.elements.playPauseBtn.addEventListener('click', () => this.callbacks.onTogglePlay());
    this.elements.stepBtn.addEventListener('click', () => this.callbacks.onStepOnce());
    this.elements.resetBtn.addEventListener('click', () => this.callbacks.onReset());
    this.elements.clearBtn.addEventListener('click', () => this.callbacks.onClear());
    this.elements.addBodyBtn.addEventListener('click', () => this.callbacks.onAddBody());
    this.elements.loadMRUBtn.addEventListener('click', () => this.callbacks.onLoadMRU());
    this.elements.loadFreeFallBtn.addEventListener('click', () => this.callbacks.onLoadFreeFall());
    this.elements.loadProjectileBtn.addEventListener('click', () => this.callbacks.onLoadProjectile());

    this.elements.timeScaleInput.addEventListener('input', () => {
      const timeScale = Number.parseFloat(this.elements.timeScaleInput.value);
      this.elements.timeScaleValue.textContent = `${timeScale.toFixed(2)}x`;
      this.callbacks.onTimeScaleChange(timeScale);
    });

    this.elements.useForcesCheckbox.addEventListener('change', () => {
      this.callbacks.onUseForcesChange(this.elements.useForcesCheckbox.checked);
    });

    this.elements.showGridCheckbox.addEventListener('change', () => this.callbacks.onDisplaySettingsChange());
    this.elements.showVectorsCheckbox.addEventListener('change', () => this.callbacks.onDisplaySettingsChange());
    this.elements.showTrajectoriesCheckbox.addEventListener('change', () => this.callbacks.onDisplaySettingsChange());
  }

  getDisplaySettings() {
    return {
      showGrid: this.elements.showGridCheckbox.checked,
      showVectors: this.elements.showVectorsCheckbox.checked,
      showTrajectories: this.elements.showTrajectoriesCheckbox.checked
    };
  }

  setUseForces(value) {
    this.elements.useForcesCheckbox.checked = value;
  }

  updateRunningState(isRunning) {
    this.elements.playPauseBtn.textContent = isRunning ? 'Pause' : 'Play';
    this.elements.stepBtn.disabled = isRunning;
    this.elements.runStateBadge.textContent = isRunning ? 'Running' : 'Paused';
    this.elements.runStateBadge.classList.toggle('running', isRunning);
    this.elements.dragHint.textContent = isRunning
      ? 'Dragging is disabled while the simulation is running.'
      : 'Pause the simulation to drag objects directly on the canvas.';
  }
}
