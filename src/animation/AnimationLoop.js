import { AppConfig } from '../app/AppConfig.js';
import { SimulationClock } from '../core/simulation/SimulationClock.js';

/**
 * requestAnimationFrame loop that coordinates stepping and rendering.
 */
export class AnimationLoop {
  constructor({
    clock = new SimulationClock(),
    fixedStep = AppConfig.simulation.fixedStep,
    maxDt = AppConfig.simulation.maxDt,
    timeScale = AppConfig.simulation.initialTimeScale,
    onStep,
    onRender,
    onStateChange
  } = {}) {
    this.clock = clock;
    this.fixedStep = fixedStep;
    this.maxDt = maxDt;
    this.timeScale = timeScale;
    this.onStep = onStep;
    this.onRender = onRender;
    this.onStateChange = onStateChange;
    this.isRunning = false;
    this.frameId = null;
    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.clock.reset();
    this.frameId = requestAnimationFrame(this.tick);
    this.emitStateChange();
  }

  pause() {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.clock.reset();
    this.emitStateChange();
    this.onRender?.();
  }

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  /**
   * Advance one fixed simulation step while paused.
   */
  stepOnce() {
    if (this.isRunning) {
      return;
    }
    this.onStep?.(this.fixedStep * this.timeScale);
    this.onRender?.();
  }

  reset() {
    this.pause();
    this.clock.reset();
    this.onRender?.();
  }

  /**
   * @param {number} timeScale
   */
  setTimeScale(timeScale) {
    this.timeScale = Math.max(0.01, timeScale);
  }

  /**
   * @param {DOMHighResTimeStamp} timestamp
   */
  tick(timestamp) {
    if (!this.isRunning) {
      return;
    }

    const realDt = Math.min(this.clock.tick(timestamp), this.maxDt);
    const scaledDt = realDt * this.timeScale;
    if (scaledDt > 0) {
      this.onStep?.(scaledDt);
    }
    this.onRender?.();
    this.frameId = requestAnimationFrame(this.tick);
  }

  emitStateChange() {
    this.onStateChange?.(this.isRunning);
  }
}
