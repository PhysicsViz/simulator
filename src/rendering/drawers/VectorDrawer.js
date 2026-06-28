import { Vector2 } from '../../core/math/Vector2.js';

/**
 * Draws vector arrows and labels on a canvas.
 */
export class VectorDrawer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../camera/Camera2D.js').Camera2D} camera
   * @param {Vector2} start World-space start point.
   * @param {Vector2} vector World-space vector.
   * @param {object} options
   * @param {string} options.color
   * @param {string} options.label
   * @param {number} [options.lineWidth]
   * @param {number} [options.minLength]
   * @param {object} style
   */
  drawVector(ctx, camera, start, vector, options, style) {
    const magnitude = vector.norm();
    if (magnitude < 0.0001) {
      return;
    }

    const screenStart = camera.worldToScreen(start);
    const screenEnd = camera.worldToScreen(start.add(vector));
    const dx = screenEnd.x - screenStart.x;
    const dy = screenEnd.y - screenStart.y;
    const screenLength = Math.hypot(dx, dy);

    if (screenLength < (options.minLength ?? 5)) {
      return;
    }

    const angle = Math.atan2(dy, dx);
    const headLength = Math.min(style.vectors.arrowHeadLength, screenLength * 0.34);

    ctx.save();
    ctx.strokeStyle = options.color;
    ctx.fillStyle = options.color;
    ctx.lineWidth = options.lineWidth ?? style.vectors.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = options.color;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(screenStart.x, screenStart.y);
    ctx.lineTo(screenEnd.x, screenEnd.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenEnd.x, screenEnd.y);
    ctx.lineTo(
      screenEnd.x - headLength * Math.cos(angle - style.vectors.arrowHeadAngle),
      screenEnd.y - headLength * Math.sin(angle - style.vectors.arrowHeadAngle)
    );
    ctx.lineTo(
      screenEnd.x - headLength * Math.cos(angle + style.vectors.arrowHeadAngle),
      screenEnd.y - headLength * Math.sin(angle + style.vectors.arrowHeadAngle)
    );
    ctx.closePath();
    ctx.fill();

    const labelDirection = new Vector2(dx, dy).normalize();
    const labelX = screenEnd.x + labelDirection.x * style.vectors.labelOffset;
    const labelY = screenEnd.y + labelDirection.y * style.vectors.labelOffset;
    ctx.shadowBlur = 0;
    ctx.font = style.typography.labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.label, labelX, labelY);
    ctx.restore();
  }
}
