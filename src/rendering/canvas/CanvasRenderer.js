import { Vector2 } from '../../core/math/Vector2.js';
import { BodyDrawer } from '../drawers/BodyDrawer.js';
import { ForceDrawer } from '../drawers/ForceDrawer.js';
import { GridDrawer } from '../drawers/GridDrawer.js';
import { TrajectoryDrawer } from '../drawers/TrajectoryDrawer.js';
import { VectorDrawer } from '../drawers/VectorDrawer.js';
import { RenderStyle } from '../styles/RenderStyle.js';

/**
 * Coordinates all canvas drawing. Rendering may read world state but never mutates it.
 */
export class CanvasRenderer {
  constructor(canvas, world, camera, style = RenderStyle) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.camera = camera;
    this.style = style;
    this.gridDrawer = new GridDrawer();
    this.vectorDrawer = new VectorDrawer();
    this.forceDrawer = new ForceDrawer(this.vectorDrawer);
    this.bodyDrawer = new BodyDrawer();
    this.trajectoryDrawer = new TrajectoryDrawer();
    this.pixelRatio = window.devicePixelRatio || 1;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(width * this.pixelRatio);
    this.canvas.height = Math.floor(height * this.pixelRatio);
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.camera.setViewport(width, height);
  }

  /**
   * @param {object} options
   * @param {import('../../core/physics/bodies/PointBody.js').PointBody | null} options.selectedBody
   * @param {boolean} options.showGrid
   * @param {boolean} options.showVectors
   * @param {boolean} options.showTrajectories
   * @param {boolean} options.isRunning
   */
  render({ selectedBody = null, showGrid = true, showVectors = true, showTrajectories = true, isRunning = false } = {}) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const ctx = this.ctx;

    ctx.save();
    ctx.fillStyle = this.style.colors.canvasBackground;
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      this.gridDrawer.draw(ctx, this.camera, width, height, this.style);
    }

    if (showTrajectories) {
      for (const body of this.world.bodies) {
        if (body.visual.showTrajectory) {
          this.trajectoryDrawer.draw(ctx, this.camera, body, this.style);
        }
      }
    }

    if (showVectors) {
      this.drawVectors(ctx);
    }

    for (const body of this.world.bodies) {
      this.bodyDrawer.draw(ctx, this.camera, body, selectedBody?.id === body.id, this.style);
    }

    this.drawTimeBadge(ctx, width, isRunning);
    ctx.restore();
  }

  drawVectors(ctx) {
    for (const body of this.world.bodies) {
      if (body.visual.showPositionVector) {
        this.vectorDrawer.drawVector(ctx, this.camera, Vector2.zero(), body.position, {
          color: this.style.colors.positionVector,
          label: 'r'
        }, this.style);
      }
      if (body.visual.showVelocityVector) {
        this.vectorDrawer.drawVector(
          ctx,
          this.camera,
          body.position,
          body.velocity.scale(this.style.vectors.velocityScale),
          { color: this.style.colors.velocityVector, label: 'v' },
          this.style
        );
      }
      if (body.visual.showAccelerationVector) {
        this.vectorDrawer.drawVector(
          ctx,
          this.camera,
          body.position,
          body.acceleration.scale(this.style.vectors.accelerationScale),
          { color: this.style.colors.accelerationVector, label: 'a' },
          this.style
        );
      }
      if (body.visual.showForces) {
        this.forceDrawer.draw(ctx, this.camera, body, this.style);
      }
    }
  }

  drawTimeBadge(ctx, width, isRunning) {
    const label = `t = ${this.world.time.toFixed(2)} s`;
    const badgeWidth = Math.max(112, ctx.measureText(label).width + 30);
    const x = width - badgeWidth - 18;
    const y = 18;

    ctx.save();
    ctx.fillStyle = this.style.colors.badgeBackground;
    ctx.strokeStyle = isRunning ? 'rgba(52, 211, 153, 0.55)' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, badgeWidth, 34, 17);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.style.colors.text;
    ctx.font = this.style.typography.badgeFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + badgeWidth / 2, y + 17);
    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }
}
