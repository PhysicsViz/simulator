import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/sandbox/model.js';
import '../../src/sandbox/presets.js';
const physics = globalThis.sandbox_model, presets = globalThis.sandbox_presets;
function example() {
    const world = physics.createWorld({ gravity: 4 });
    const a = physics.addBody(world, { x: -100, y: 50, vx: 2 });
    const b = physics.addBody(world, { x: -98, y: 50 });
    physics.addRod(world, a, b, undefined, { mode: 'anchor-a' });
    return presets.create('Linked bodies', physics.snapshot(world), { centerX: -99, centerY: 30, scale: 5 });
}
function storage() { let raw = null; return { getItem: () => raw, setItem: (_key, value) => { raw = value; } }; }

test('presets round-trip all starting properties, connection modes, gravity and camera', () => {
    const store = storage(), preset = example();
    presets.write(store, [preset]);
    assert.deepEqual(presets.read(store), [preset]);
    const world = physics.createWorld(); physics.restore(world, presets.read(store)[0].scene);
    physics.advance(world, .5); physics.restore(world, preset.scene);
    assert.equal(world.time, 0); assert.equal(world.bodies[0].x, -100); assert.equal(world.bodies[0].vx, 2);
    assert.equal(world.rods[0].mode, 'anchor-a'); assert.equal(world.gravity, 4);
});

test('creating a preset takes an independent copy of the starting scene', () => {
    const preset = example(), copy = presets.create('Copy', preset.scene, preset.view);
    preset.scene.bodies[0].x = 200; preset.view.centerX = 0;
    assert.equal(copy.scene.bodies[0].x, -100); assert.equal(copy.view.centerX, -99);
});

test('storage errors and malformed libraries are reported rather than loading invalid physics', () => {
    assert.throws(() => presets.write({ setItem() { throw new Error('quota'); } }, [example()]), /quota/);
    assert.throws(() => presets.read({ getItem: () => '{broken' }));
    const preset = example(); preset.scene.rods[0].a = 999;
    assert.throws(() => presets.read({ getItem: () => JSON.stringify({ version: 1, presets: [preset] }) }), /Invalid rod/);
    assert.throws(() => presets.read({ getItem: () => JSON.stringify({ version: 2, presets: [] }) }));
});
