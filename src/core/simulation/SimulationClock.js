/**
 * Converts requestAnimationFrame timestamps into real elapsed seconds.
 */
export class SimulationClock {
  constructor() {
    this.lastTimestamp = null;
  }

  reset() {
    this.lastTimestamp = null;
  }

  /**
   * @param {DOMHighResTimeStamp} timestamp
   * @returns {number} Elapsed real time in seconds.
   */
  tick(timestamp) {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return 0;
    }
    const dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    return Math.max(0, dt);
  }
}
