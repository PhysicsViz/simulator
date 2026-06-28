/**
 * Central selected-body state shared by UI and mouse input.
 */
export class SelectionController {
  constructor(world) {
    this.world = world;
    this.selectedBodyId = null;
    this.listeners = new Set();
  }

  /**
   * @param {import('../core/physics/bodies/PointBody.js').PointBody | null} body
   */
  selectBody(body) {
    const nextId = body?.id ?? null;
    if (this.selectedBodyId === nextId) {
      return;
    }
    this.selectedBodyId = nextId;
    this.emitChange();
  }

  /**
   * @param {string | null} id
   */
  selectById(id) {
    this.selectBody(id ? this.world.getBodyById(id) ?? null : null);
  }

  clear() {
    this.selectBody(null);
  }

  getSelectedBody() {
    if (!this.selectedBodyId) {
      return null;
    }
    return this.world.getBodyById(this.selectedBodyId) ?? null;
  }

  /**
   * @param {(body: import('../core/physics/bodies/PointBody.js').PointBody | null) => void} listener
   */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitChange() {
    const selected = this.getSelectedBody();
    for (const listener of this.listeners) {
      listener(selected);
    }
  }
}
