import { Vector2 } from '../../core/math/Vector2.js';

/**
 * Converts between SI world coordinates and canvas screen coordinates.
 * World y is positive upward; canvas y is positive downward.
 */
export class Camera2D {
  constructor({
    pixelsPerMeter = 34,
    minPixelsPerMeter = 10,
    maxPixelsPerMeter = 140
  } = {}) {
    this.pixelsPerMeter = pixelsPerMeter;
    this.minPixelsPerMeter = minPixelsPerMeter;
    this.maxPixelsPerMeter = maxPixelsPerMeter;
    this.origin = { x: 0, y: 0 };
    this.viewportWidth = 1;
    this.viewportHeight = 1;
    this.hasUserTransform = false;
  }

  /**
   * @param {number} width Canvas width in CSS pixels.
   * @param {number} height Canvas height in CSS pixels.
   */
  setViewport(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    if (!this.hasUserTransform) {
      this.origin = {
        x: Math.max(96, Math.min(width * 0.24, 210)),
        y: height * 0.72
      };
    }
  }

  /**
   * @param {Vector2} position World position in meters.
   * @returns {{x: number, y: number}}
   */
  worldToScreen(position) {
    return {
      x: this.origin.x + position.x * this.pixelsPerMeter,
      y: this.origin.y - position.y * this.pixelsPerMeter
    };
  }

  /**
   * @param {{x: number, y: number}} position Screen position in CSS pixels.
   * @returns {Vector2}
   */
  screenToWorld(position) {
    return new Vector2(
      (position.x - this.origin.x) / this.pixelsPerMeter,
      (this.origin.y - position.y) / this.pixelsPerMeter
    );
  }

  /**
   * @param {number} dx Screen-space horizontal pan in pixels.
   * @param {number} dy Screen-space vertical pan in pixels.
   */
  pan(dx, dy) {
    this.origin.x += dx;
    this.origin.y += dy;
    this.hasUserTransform = true;
  }

  /**
   * Zoom around a fixed screen point.
   * @param {{x: number, y: number}} screenPoint
   * @param {number} factor
   */
  zoomAt(screenPoint, factor) {
    const before = this.screenToWorld(screenPoint);
    this.pixelsPerMeter = Math.min(
      this.maxPixelsPerMeter,
      Math.max(this.minPixelsPerMeter, this.pixelsPerMeter * factor)
    );
    const after = this.worldToScreen(before);
    this.pan(screenPoint.x - after.x, screenPoint.y - after.y);
  }
}
