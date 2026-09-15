/*
 * game.test.js — Unit tests for the pendulum wall-breaker game logic: wall
 * generation (bounds, radial bands, ordering), the feasibility checker, a
 * Monte-Carlo guarantee that every generated situation is solvable, radial
 * contact detection and arc crossing detection. game.js exits before any DOM
 * access under Node, so a side-effect import only exposes globalThis.pendulum_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/pendulum/game.js";

const {
    randomWalls,
    buildCandidate,
    isSituationFeasible,
    isCrossing,
    isWithinBand,
    MILESTONES,
    START_GAP_DEGREES,
} = globalThis.pendulum_game;

test("buildCandidate stays within its documented bounds", () => {
    const low = buildCandidate(9.81, 1, () => 0);
    assert.equal(low.break_wall.angle_degrees, -20);
    assert.equal(low.preserve_wall.angle_degrees, -35);
    assert.equal(low.break_wall.min_speed, 3);
    assert.equal(low.break_wall.inner_radius, 0.8);
    assert.equal(low.break_wall.outer_radius, 1.6);
    assert.ok(Math.abs(low.preserve_wall.inner_radius - 0.7) < 1e-12);
    assert.ok(Math.abs(low.preserve_wall.outer_radius - 1.7) < 1e-12);
    assert.equal(low.min_start_angle_degrees, 60);
    const high = buildCandidate(9.81, 1, () => 0.999999);
    assert.ok(high.break_wall.angle_degrees > -50.001);
    assert.ok(high.break_wall.outer_radius < 3.600001);
    assert.ok(high.preserve_wall.outer_radius < 4.100001);
});

test("the preserve wall is always at a farther angle than the wall to smash", () => {
    for (const seed of [0, 0.3, 0.7, 0.99]) {
        const walls = buildCandidate(9.81, 1, () => seed);
        assert.ok(walls.preserve_wall.angle_degrees < walls.break_wall.angle_degrees, `seed ${seed}`);
    }
});

test("the preserve band always covers the orange band — no dodge is possible", () => {
    for (const seed of [0, 0.2, 0.5, 0.8, 0.999]) {
        const walls = buildCandidate(9.81, 1, () => seed);
        assert.ok(walls.preserve_wall.inner_radius <= walls.break_wall.inner_radius, `inner, seed ${seed}`);
        assert.ok(walls.preserve_wall.outer_radius >= walls.break_wall.outer_radius, `outer, seed ${seed}`);
    }
    for (let i = 0; i < 200; i++) {
        const walls = randomWalls(9.81, 1, Math.random);
        assert.ok(walls.preserve_wall.inner_radius <= walls.break_wall.inner_radius, "inner (random)");
        assert.ok(walls.preserve_wall.outer_radius >= walls.break_wall.outer_radius, "outer (random)");
    }
});

test("isWithinBand matches the wall's radial band inclusively", () => {
    const wall = { inner_radius: 1.2, outer_radius: 2.4 };
    assert.equal(isWithinBand(1.2, wall), true, "inner edge");
    assert.equal(isWithinBand(2.4, wall), true, "outer edge");
    assert.equal(isWithinBand(1.8, wall), true, "inside");
    assert.equal(isWithinBand(1.1, wall), false, "below");
    assert.equal(isWithinBand(2.5, wall), false, "above");
});

test("isSituationFeasible rejects an unreachable orange wall", () => {
    const walls = buildCandidate(9.81, 1, () => 0.5);
    const unreachable = {
        ...walls,
        break_wall: { ...walls.break_wall, inner_radius: 6, outer_radius: 8 },
    };
    assert.equal(isSituationFeasible(unreachable, 9.81, 1), false);
});

test("isSituationFeasible rejects an impossible tension limit", () => {
    const walls = buildCandidate(9.81, 1, () => 0.5);
    const strangled = { ...walls, tension_max: 0.01 };
    assert.equal(isSituationFeasible(strangled, 9.81, 1), false);
});

test("isSituationFeasible rejects an empty speed window when the bands force contact", () => {
    // gray wall covers the whole playable length range with a tiny threshold and
    // sits so close to the orange wall that the energy gap cannot open a window
    const walls = buildCandidate(9.81, 1, () => 0.5);
    const impossible = {
        ...walls,
        break_wall: { ...walls.break_wall, min_speed: 9.9 },
        preserve_wall: {
            angle_degrees: walls.break_wall.angle_degrees - 0.1,
            max_speed: 0.5,
            inner_radius: 0,
            outer_radius: 10,
        },
        tension_max: 1000,
    };
    assert.equal(isSituationFeasible(impossible, 9.81, 1), false);
});

test("every generated situation is feasible (Monte-Carlo, several g and m)", () => {
    const configurations = [
        { gravity: 9.81, mass: 1 },
        { gravity: 3.7, mass: 1 },
        { gravity: 20, mass: 2.5 },
    ];
    for (const { gravity, mass } of configurations) {
        for (let i = 0; i < 300; i++) {
            const walls = randomWalls(gravity, mass, Math.random);
            assert.equal(
                isSituationFeasible(walls, gravity, mass),
                true,
                `infeasible situation for g=${gravity}, m=${mass}: ${JSON.stringify(walls)}`,
            );
        }
    }
});

test("tension limit always leaves headroom above the minimum successful swing", () => {
    for (const seed of [0, 0.25, 0.5, 0.75, 0.999]) {
        const walls = buildCandidate(9.81, 1, () => seed);
        const reference_length = (walls.break_wall.inner_radius + walls.break_wall.outer_radius) / 2;
        const break_angle = walls.break_wall.angle_degrees * Math.PI / 180;
        const bottom_speed_squared = walls.break_wall.min_speed ** 2
            + 2 * 9.81 * reference_length * (1 - Math.cos(break_angle));
        const required_tension = 1 * (9.81 + bottom_speed_squared / reference_length);
        assert.ok(walls.tension_max >= required_tension * 1.15 - 1e-9, `feasible for seed ${seed}`);
    }
});

test("forced start angle keeps the documented gap from the wall to smash", () => {
    const walls = buildCandidate(9.81, 1, () => 0.5);
    assert.ok(walls.min_start_angle_degrees >= walls.break_wall.angle_degrees + START_GAP_DEGREES - 1);
    assert.ok(walls.min_start_angle_degrees > 0, "start is on the opposite side");
});

test("isCrossing detects passing the wall angle in either direction", () => {
    assert.equal(isCrossing(-0.3, -0.6, -0.5), true, "toward negative");
    assert.equal(isCrossing(-0.6, -0.3, -0.5), true, "swinging back");
    assert.equal(isCrossing(-0.3, -0.4, -0.5), false, "not reached");
    assert.equal(isCrossing(-0.6, -0.7, -0.5), false, "already past");
    assert.equal(isCrossing(-0.5, -0.5, -0.5), false, "no motion");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
