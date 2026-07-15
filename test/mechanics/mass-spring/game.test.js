/*
 * game.test.js — Unit tests for the trampoline-safety game logic: the two
 * stiffness bounds (frame clearance via the course formula, acceleration
 * limit via the exact closed form k ≤ m·g·(n²−1)/(2h)), challenge generation
 * bounds, Monte-Carlo feasibility (a slider-grid k always satisfies both
 * constraints) and the checker's rejections. game.js exits before any DOM
 * access under Node, so a side-effect import (after calcul.js, which it
 * reads) only exposes globalThis.mass_spring_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/mass-spring/calcul.js";
import "../../../src/mechanics/mass-spring/game.js";

const calc = globalThis.mass_spring_calcul;
const {
    minimumStiffness,
    maximumStiffness,
    isSituationFeasible,
    randomChallenge,
    MILESTONES,
    GRAVITY,
    STIFFNESS_STEP,
    STIFFNESS_MAX,
} = globalThis.mass_spring_game;

const FALLBACK = { mass: 68, drop_height: 3, frame_depth: 0.5, acceleration_limit: 16 };

test("minimumStiffness is the course formula with d = frame depth", () => {
    const floor = minimumStiffness(FALLBACK);
    assert.ok(Math.abs(floor - 2 * 68 * GRAVITY * 3.5 / 0.25) < 1e-9, "k_min = 2·m·g·(h+D)/D²");
    assert.ok(
        calc.maxDepression(68, GRAVITY, 3, floor) <= 0.5 + 1e-9,
        "at k_min the bed just clears the frame",
    );
});

test("maximumStiffness enforces the acceleration limit exactly", () => {
    const ceiling = maximumStiffness(FALLBACK);
    assert.ok(Math.abs(ceiling - 68 * GRAVITY * 255 / 6) < 1e-9, "k_max = m·g·(n²−1)/(2h)");
    assert.ok(
        Math.abs(calc.maxAcceleration(68, GRAVITY, 3, ceiling) - 16 * GRAVITY) < 1e-6,
        "at k_max the peak acceleration is exactly n·g",
    );
});

test("the deterministic fallback mission is feasible with a real window", () => {
    assert.equal(isSituationFeasible(FALLBACK), true, "fallback feasible");
    assert.ok(minimumStiffness(FALLBACK) < maximumStiffness(FALLBACK), "non-empty window");
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.mass >= 40 && challenge.mass <= 100, "mass range");
        assert.ok(challenge.drop_height >= 1 && challenge.drop_height <= 5, "height range");
        assert.ok(challenge.frame_depth >= 0.3 && challenge.frame_depth <= 0.8 + 1e-12, "frame range");
        assert.ok(challenge.acceleration_limit > 1, "meaningful acceleration limit");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("the winning grid stiffness satisfies both constraints (Monte-Carlo)", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        const grid = Math.ceil(minimumStiffness(challenge) / STIFFNESS_STEP - 1e-9) * STIFFNESS_STEP;
        assert.ok(grid <= STIFFNESS_MAX, "grid k within the slider");
        assert.ok(
            calc.maxDepression(challenge.mass, GRAVITY, challenge.drop_height, grid)
                <= challenge.frame_depth + 1e-9,
            "the bed clears the frame",
        );
        assert.ok(
            calc.maxAcceleration(challenge.mass, GRAVITY, challenge.drop_height, grid)
                <= challenge.acceleration_limit * GRAVITY + 1e-9,
            "the landing stays under the acceleration limit",
        );
    }
});

test("isSituationFeasible rejects out-of-range or impossible missions", () => {
    assert.equal(isSituationFeasible({ ...FALLBACK, mass: 20 }), false, "mass out of range");
    assert.equal(isSituationFeasible({ ...FALLBACK, frame_depth: 1.5 }), false, "frame out of range");
    assert.equal(isSituationFeasible({ ...FALLBACK, acceleration_limit: 1 }), false, "no legal stiffness");
    assert.equal(
        isSituationFeasible({ ...FALLBACK, acceleration_limit: 8 }),
        false,
        "acceleration cap below the frame-clearance stiffness",
    );
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
