import { Vector2 } from '../../core/math/Vector2.js';
import { PointBody } from '../../core/physics/bodies/PointBody.js';

const PALETTE = ['#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#f87171'];

/**
 * Creates new point bodies from UI commands.
 */
export class ObjectCreationController {
  constructor({ world, selectionController, camera, onChange }) {
    this.world = world;
    this.selectionController = selectionController;
    this.camera = camera;
    this.onChange = onChange;
    this.createdCount = 0;
  }

  createDefaultBody() {
    this.createdCount += 1;
    const center = this.camera.screenToWorld({
      x: this.camera.viewportWidth * 0.5,
      y: this.camera.viewportHeight * 0.55
    });

    const body = new PointBody({
      name: `Object ${this.world.bodies.length + 1}`,
      mass: 1,
      position: center.add(new Vector2(this.createdCount * 0.4, 0)),
      velocity: new Vector2(2, 2),
      acceleration: Vector2.zero(),
      visual: {
        color: PALETTE[(this.createdCount - 1) % PALETTE.length]
      }
    });

    body.saveInitialState();
    this.world.addBody(body);
    this.selectionController.selectBody(body);
    this.onChange?.();
    return body;
  }
}
