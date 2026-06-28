/**
 * Draws point masses as visually styled particles.
 */
export class BodyDrawer {
  draw(ctx, camera, body, isSelected, style) {
    const screen = camera.worldToScreen(body.position);
    const radius = body.visual.radius;

    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = body.visual.color;
    ctx.shadowColor = body.visual.color;
    ctx.shadowBlur = 16;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = style.body.outlineWidth;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.stroke();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius + 7, 0, Math.PI * 2);
      ctx.strokeStyle = style.colors.selected;
      ctx.lineWidth = style.body.selectedHaloWidth;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.font = style.typography.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(body.name, screen.x, screen.y + radius + 9);
    ctx.restore();
  }
}
