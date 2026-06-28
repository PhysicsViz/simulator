/**
 * Handles canvas selection, paused dragging, panning and zooming.
 */
export class MouseController {
  constructor({ canvas, camera, world, selectionController, animationLoop, onChange }) {
    this.canvas = canvas;
    this.camera = camera;
    this.world = world;
    this.selectionController = selectionController;
    this.animationLoop = animationLoop;
    this.onChange = onChange;
    this.draggedBody = null;
    this.dragOffset = null;
    this.isPanning = false;
    this.lastPointer = null;
    this.bind();
  }

  bind() {
    this.canvas.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    this.canvas.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    window.addEventListener('pointerup', (event) => this.handlePointerUp(event));
    this.canvas.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  handlePointerDown(event) {
    const screen = this.getCanvasPoint(event);
    this.lastPointer = screen;

    if (event.button === 1 || event.button === 2 || event.shiftKey || event.altKey) {
      this.isPanning = true;
      this.canvas.setPointerCapture?.(event.pointerId);
      return;
    }

    const hitBody = this.hitTest(screen);
    this.selectionController.selectBody(hitBody);

    if (hitBody && !this.animationLoop.isRunning) {
      const worldPoint = this.camera.screenToWorld(screen);
      this.draggedBody = hitBody;
      this.dragOffset = hitBody.position.subtract(worldPoint);
      this.canvas.classList.add('is-dragging');
      this.canvas.setPointerCapture?.(event.pointerId);
    }

    this.onChange?.();
  }

  handlePointerMove(event) {
    const screen = this.getCanvasPoint(event);

    if (this.isPanning && this.lastPointer) {
      this.camera.pan(screen.x - this.lastPointer.x, screen.y - this.lastPointer.y);
      this.lastPointer = screen;
      this.onChange?.();
      return;
    }

    if (this.draggedBody && !this.animationLoop.isRunning) {
      const worldPoint = this.camera.screenToWorld(screen);
      this.draggedBody.position = worldPoint.add(this.dragOffset);
      this.draggedBody.trajectory = [this.draggedBody.position.clone()];
      this.onChange?.();
      return;
    }

    this.canvas.classList.toggle('can-grab', Boolean(this.hitTest(screen)) && !this.animationLoop.isRunning);
  }

  handlePointerUp(event) {
    if (this.draggedBody) {
      this.draggedBody.saveInitialState();
    }
    this.draggedBody = null;
    this.dragOffset = null;
    this.isPanning = false;
    this.lastPointer = null;
    this.canvas.classList.remove('is-dragging');
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.onChange?.();
  }

  handleWheel(event) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    this.camera.zoomAt(this.getCanvasPoint(event), factor);
    this.onChange?.();
  }

  hitTest(screenPoint) {
    let bestBody = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const body of this.world.bodies) {
      const screen = this.camera.worldToScreen(body.position);
      const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
      const hitRadius = body.visual.radius + 8;
      if (distance <= hitRadius && distance < bestDistance) {
        bestBody = body;
        bestDistance = distance;
      }
    }
    return bestBody;
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
}
