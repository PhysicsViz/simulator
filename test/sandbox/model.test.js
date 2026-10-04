import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/sandbox/model.js';
const { createWorld, addBody, addRod, removeBody, registerForce, advance, snapshot, restore } = globalThis.sandbox_model;
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test('graph histories use actual simulation time and are excluded from saved setups', () => {
    const world = createWorld({ gravity: 0 }), b = addBody(world, { x: 4, y: 5, vx: 2 });
    const saved = snapshot(world);
    advance(world, .02); advance(world, .07);
    assert.equal(b.history.length, 3); close(b.history[0].time, 0); close(b.history[1].time, .02);
    close(b.history[2].time, .09); close(b.history[2].x, 4.18); close(b.history[2].vx, 2);
    assert.equal('history' in snapshot(world).bodies[0], false);
    restore(world, saved); assert.equal(world.bodies[0].history.length, 1); close(world.bodies[0].history[0].time, 0);
});

test('graph histories remain bounded while preserving their latest samples', () => {
    const world = createWorld({ gravity: 0 }), b = addBody(world, { x: 4, y: 5, vx: 1 });
    for (let i = 0; i < 2200; i++) advance(world, .001);
    assert.ok(b.history.length <= 2000); assert.equal(b.history[0].time, 0);
    close(b.history.at(-1).time, world.time); close(b.history.at(-1).x, b.x);
    assert.ok(b.history.every((s, i) => i === 0 || s.time > b.history[i - 1].time));
});

test('graph histories discard samples older than the last minute', () => {
    const world = createWorld({ gravity: 0 }), b = addBody(world, { x: 4, y: 5 });
    for (let i = 0; i < 70; i++) advance(world, 1);
    assert.ok(b.history[0].time >= world.time - 60);
    assert.ok(b.history[0].time > 0); close(b.history.at(-1).time, world.time);
});

test('a free body follows projectile kinematics under shared gravity', () => {
    const world = createWorld({ width: 100, height: 100 });
    const b = addBody(world, { x: 10, y: 50, vx: 4, vy: 6 });
    advance(world, 1);
    close(b.x, 14); close(b.y, 50 + 6 - .5 * 9.81); close(b.vy, 6 - 9.81);
});

test('elastic collisions transfer momentum between unequal masses', () => {
    const world = createWorld({ gravity: 0 });
    const a = addBody(world, { x: 4, y: 5, vx: 3, mass: 2, restitution: 1 });
    const b = addBody(world, { x: 5, y: 5, mass: 1, restitution: 1 });
    advance(world, .5);
    close(a.vx, 1); close(b.vx, 4);
    close(2 * a.vx + b.vx, 6);
    close(.5 * 2 * a.vx ** 2 + .5 * b.vx ** 2, 9);
});

test('fast small bodies do not pass through one another', () => {
    const world = createWorld({ gravity: 0 });
    const a = addBody(world, { x: 4, y: 5, vx: 50, radius: .1, restitution: 1 });
    const b = addBody(world, { x: 5, y: 5, vx: -50, radius: .1, restitution: 1 });
    advance(world, .02);
    close(a.vx, -50); close(b.vx, 50); assert.ok(a.x < b.x);
});

test('fixed bodies stay still while reflecting incoming bodies', () => {
    const world = createWorld({ gravity: 0 });
    const a = addBody(world, { x: 4, y: 5, vx: 3, restitution: 1 });
    const anchor = addBody(world, { x: 5, y: 5, fixed: true, restitution: 1 });
    advance(world, .3);
    close(a.vx, -3); close(anchor.x, 5); close(anchor.vx, 0);
});

test('floor contacts use restitution and keep bodies inside the world', () => {
    const world = createWorld({ gravity: 0 });
    const b = addBody(world, { x: 4, y: .31, vy: -2, restitution: .5 });
    advance(world, .02);
    close(b.vy, 1); assert.ok(b.y >= b.radius);
});

test('pendulum rod maintains its length under gravity', () => {
    const world = createWorld();
    const a = addBody(world, { x: 8, y: 7, fixed: true, radius: .15 });
    const b = addBody(world, { x: 10, y: 7 });
    addRod(world, a, b);
    advance(world, 2);
    close(Math.hypot(b.x - a.x, b.y - a.y), 2, 1e-6);
    assert.ok(b.y < 7); close(a.x, 8); close(a.y, 7);
});

test('a rod connects moving endpoints and preserves total momentum', () => {
    const world = createWorld({ gravity: 0 });
    const a = addBody(world, { x: 5, y: 5, vx: -1, mass: 2 });
    const b = addBody(world, { x: 7, y: 5, vx: 2 });
    addRod(world, a, b); advance(world, .1);
    close(b.x - a.x, 2); close(2 * a.vx + b.vx, 0); close(a.vx, b.vx);
});

test('a swinging pendulum transfers momentum to a free body', () => {
    const world = createWorld();
    const anchor = addBody(world, { x: 6, y: 3, fixed: true, radius: .16 });
    const bob = addBody(world, { x: 3.3, y: 3 }); addRod(world, anchor, bob);
    const target = addBody(world, { x: 6.6, y: .3 });
    advance(world, 1.5);
    assert.ok(target.x > 7, `target x: ${target.x}`);
    assert.ok(target.vx > 1, `target vx: ${target.vx}`);
});

test('force providers affect the same bodies and can be unregistered', () => {
    const world = createWorld({ gravity: 0 });
    const b = addBody(world, { x: 5, y: 5, mass: 2 });
    const unregister = registerForce(world, (_world, addForce) => addForce(b.id, 4, 0));
    advance(world, .5); close(b.vx, 1); close(b.x, 5.25);
    unregister(); advance(world, .5); close(b.vx, 1); close(b.x, 5.75);
});

test('restoring a setup keeps bodies and connections and clears playback state', () => {
    const world = createWorld();
    const a = addBody(world, { x: 5, y: 5, fixed: true });
    const b = addBody(world, { x: 7, y: 5 }); addRod(world, a, b);
    const saved = snapshot(world); advance(world, .5); removeBody(world, a.id);
    assert.equal(world.rods.length, 0);
    restore(world, saved);
    assert.equal(world.bodies.length, 2); assert.equal(world.rods.length, 1);
    assert.equal(world.time, 0); assert.equal(world.bodies[1].trail.length, 0);
    close(world.bodies[1].x, 7);
    world.bodies[1].x = 9; restore(world, saved); close(world.bodies[1].x, 7);
});

test('invalid rods and time steps are rejected', () => {
    const world = createWorld(), a = addBody(world), b = addBody(world, { x: 6 });
    assert.equal(addRod(world, a, a), null);
    assert.equal(addRod(world, a, b, .1), null);
    assert.ok(addRod(world, a, b)); assert.equal(addRod(world, b, a), null);
    assert.throws(() => advance(world, -1), RangeError);
    assert.throws(() => advance(world, Infinity), RangeError);
});

test('moving-anchor mode moves the follower without slowing the anchor', () => {
    const world = createWorld({ gravity: 0 });
    const anchor = addBody(world, { x: 5, y: 5, vx: 2 });
    const follower = addBody(world, { x: 7, y: 5 });
    addRod(world, anchor, follower, undefined, { mode: 'anchor-a' });
    advance(world, .5);
    close(anchor.x, 6); close(anchor.vx, 2);
    close(follower.x - anchor.x, 2); close(follower.vx, 2);
});

test('either endpoint can be the moving anchor', () => {
    const world = createWorld({ gravity: 0 });
    const follower = addBody(world, { x: 5, y: 5 });
    const anchor = addBody(world, { x: 7, y: 5, vx: -2 });
    addRod(world, follower, anchor, undefined, { mode: 'anchor-b' });
    advance(world, .5);
    close(anchor.x, 6); close(anchor.vx, -2);
    close(anchor.x - follower.x, 2); close(follower.vx, -2);
});

test('forces on a follower do not change its moving anchor trajectory', () => {
    const world = createWorld({ gravity: 0 });
    const anchor = addBody(world, { x: 5, y: 5, vx: 1 });
    const follower = addBody(world, { x: 7, y: 5 });
    addRod(world, anchor, follower, undefined, { mode: 'anchor-a' });
    registerForce(world, (_world, addForce) => addForce(follower.id, 10, -5));
    advance(world, .5);
    close(anchor.x, 5.5); close(anchor.y, 5); close(anchor.vx, 1); close(anchor.vy, 0);
    close(Math.hypot(follower.x - anchor.x, follower.y - anchor.y), 2, 1e-6);
    assert.ok(follower.y < 5);
});

test('a moving anchor remains subject to its own gravity and external forces', () => {
    const world = createWorld({ width: 100, height: 100 });
    const anchor = addBody(world, { x: 50, y: 50, mass: 2 });
    const follower = addBody(world, { x: 52, y: 50 });
    addRod(world, anchor, follower, undefined, { mode: 'anchor-a' });
    registerForce(world, (_world, addForce) => addForce(anchor.id, 4, 0));
    advance(world, .5);
    close(anchor.x, 50.25); close(anchor.vx, 1);
    close(anchor.y, 50 - .5 * 9.81 * .5 ** 2); close(anchor.vy, -9.81 * .5);
});

test('anchor-only endpoints do not introduce reaction through overlapping contacts', () => {
    const world = createWorld({ gravity: 0 });
    const anchor = addBody(world, { x: 5, y: 5, vx: 1 });
    const follower = addBody(world, { x: 5.6, y: 5, vx: -5 });
    addRod(world, anchor, follower, .6, { mode: 'anchor-a' });
    // Editing the body radius can make the endpoints overlap despite the rod.
    follower.radius = .4;
    advance(world, .1);
    close(anchor.x, 5.1); close(anchor.vx, 1);
    close(follower.x - anchor.x, .6);
});

test('interaction modes can be changed and survive restoring the scene', () => {
    const { setRodMode } = globalThis.sandbox_model;
    const world = createWorld({ gravity: 0 });
    const a = addBody(world, { x: 5, y: 5, vx: -1, mass: 2 });
    const b = addBody(world, { x: 7, y: 5, vx: 2 });
    const rod = addRod(world, a, b);
    assert.equal(rod.mode, 'mutual');
    setRodMode(rod, 'anchor-b');
    const saved = snapshot(world);
    setRodMode(rod, 'mutual'); restore(world, saved);
    assert.equal(world.rods[0].mode, 'anchor-b');
    advance(world, .1); close(world.bodies[1].vx, 2); close(world.bodies[0].vx, 2);
    assert.throws(() => setRodMode(world.rods[0], 'unknown'), RangeError);
});

test('bodies can travel beyond the previous side walls and ceiling', () => {
    const world = createWorld({ gravity: 0 });
    const left = addBody(world, { x: -1000, y: 20, vx: -10 });
    const right = addBody(world, { x: 1000, y: 20, vx: 10 });
    const high = addBody(world, { x: 0, y: 1000, vy: 10 });
    advance(world, 1);
    close(left.x, -1010); close(left.vx, -10);
    close(right.x, 1010); close(right.vx, 10);
    close(high.y, 1010); close(high.vy, 10);
});

test('the floor remains active far from the original scene', () => {
    const world = createWorld({ gravity: 0 });
    const left = addBody(world, { x: -10000, y: .31, vy: -2, restitution: .5 });
    const right = addBody(world, { x: 10000, y: .31, vy: -2, restitution: .5 });
    advance(world, .02);
    for (const b of [left, right]) { close(b.vy, 1); assert.ok(b.y >= b.radius); }
});
