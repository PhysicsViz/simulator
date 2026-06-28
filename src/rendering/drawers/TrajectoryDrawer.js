/**
 * Draws smooth trajectory traces from previous physical positions.
 */
export class TrajectoryDrawer {
  draw(ctx, camera, body, style) {
    if (body.trajectory.length < 2) {
      return;
    }

    ctx.save();
    ctx.lineWidth = style.trajectory.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style.colors.trajectory;
    ctx.beginPath();

    body.trajectory.forEach((position, index) => {
      const screen = camera.worldToScreen(position);
      if (index === 0) {
        ctx.moveTo(screen.x, screen.y);
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
    });

    ctx.stroke();
    ctx.restore();
  }
}
