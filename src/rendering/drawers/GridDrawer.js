/**
 * Draws grid, axes and axis labels.
 */
export class GridDrawer {
  draw(ctx, camera, width, height, style) {
    const topLeft = camera.screenToWorld({ x: 0, y: 0 });
    const bottomRight = camera.screenToWorld({ x: width, y: height });
    const minX = Math.floor(topLeft.x / style.grid.minorStepMeters) * style.grid.minorStepMeters;
    const maxX = Math.ceil(bottomRight.x / style.grid.minorStepMeters) * style.grid.minorStepMeters;
    const minY = Math.floor(bottomRight.y / style.grid.minorStepMeters) * style.grid.minorStepMeters;
    const maxY = Math.ceil(topLeft.y / style.grid.minorStepMeters) * style.grid.minorStepMeters;

    ctx.save();
    ctx.lineCap = 'butt';

    for (let x = minX; x <= maxX; x += style.grid.minorStepMeters) {
      const screen = camera.worldToScreen({ x, y: 0 });
      const isMajor = Math.abs(Math.round(x / style.grid.minorStepMeters)) % style.grid.majorEvery === 0;
      ctx.strokeStyle = isMajor ? style.colors.gridMajor : style.colors.gridMinor;
      ctx.lineWidth = isMajor ? 1 : 0.75;
      ctx.beginPath();
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, height);
      ctx.stroke();
    }

    for (let y = minY; y <= maxY; y += style.grid.minorStepMeters) {
      const screen = camera.worldToScreen({ x: 0, y });
      const isMajor = Math.abs(Math.round(y / style.grid.minorStepMeters)) % style.grid.majorEvery === 0;
      ctx.strokeStyle = isMajor ? style.colors.gridMajor : style.colors.gridMinor;
      ctx.lineWidth = isMajor ? 1 : 0.75;
      ctx.beginPath();
      ctx.moveTo(0, screen.y);
      ctx.lineTo(width, screen.y);
      ctx.stroke();
    }

    this.drawAxes(ctx, camera, width, height, style);
    ctx.restore();
  }

  drawAxes(ctx, camera, width, height, style) {
    const origin = camera.worldToScreen({ x: 0, y: 0 });
    ctx.strokeStyle = style.colors.axis;
    ctx.lineWidth = style.grid.axisWidth;
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(width, origin.y);
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, height);
    ctx.stroke();

    ctx.fillStyle = style.colors.axisLabel;
    ctx.font = style.typography.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('x (m)', Math.min(width - 46, width - 52), origin.y + 8);
    ctx.fillText('y (m)', origin.x + 8, 12);
  }
}
