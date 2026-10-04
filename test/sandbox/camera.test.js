import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/sandbox/camera.js';
const { create, transform, pan, zoom, fit } = globalThis.sandbox_camera;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test('screen and world coordinates round-trip after pan and zoom', () => {
    const camera = create(); fit(camera, [], 800, 420);
    pan(camera, 30000, -10000); zoom(camera, 800, 420, 400, 210, .5);
    const view = transform(camera, 800, 420), screen = view.toScreen(-1000, 2000);
    const point = view.toWorld(...screen);
    close(point.x, -1000); close(point.y, 2000);
});

test('wheel zoom preserves the world point under the cursor', () => {
    const camera = create(); fit(camera, [], 800, 420);
    const before = transform(camera, 800, 420).toWorld(123, 245);
    zoom(camera, 800, 420, 123, 245, 1.25);
    const after = transform(camera, 800, 420).toWorld(123, 245);
    close(before.x, after.x); close(before.y, after.y);
});

test('fit view recovers distant objects and includes the floor', () => {
    const camera = create(), bodies = [{ x: -10000, y: 5000, radius: .3 }, { x: 20000, y: 20, radius: 1 }];
    fit(camera, bodies, 800, 420);
    const view = transform(camera, 800, 420);
    for (const b of bodies) {
        assert.ok(view.left <= b.x - b.radius && view.right >= b.x + b.radius);
        assert.ok(view.top >= b.y + b.radius);
    }
    assert.ok(view.bottom <= 0);
});
