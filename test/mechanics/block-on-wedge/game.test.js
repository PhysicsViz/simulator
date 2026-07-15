/*
 * game.test.js — Unit tests for the express-delivery game logic: the force
 * window (the course answer) combined with the timing requirement, challenge
 * generation bounds, Monte-Carlo feasibility (a slider-grid F is fast enough
 * and inside the friction cone) and finish-line interpolation. game.js exits
 * before any DOM access under Node, so a side-effect import (after calcul.js,
 * which it reads) only exposes globalThis.block_wedge_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/block-on-wedge/calcul.js";
import "../../../src/mechanics/block-on-wedge/game.js";

const calc = globalThis.block_wedge_calcul;
const {
    minimumForceForTime,
    forceWindow,
    isSituationFeasible,
    randomChallenge,
    crossingTime,
    MILESTONES,
    GRAVITY,
    FORCE_STEP,
    FORCE_MAX,
} = globalThis.block_wedge_game;

const FALLBACK = {
    block_mass: 0.5,
    wedge_mass: 2,
    incline_degrees: 40,
    friction_coefficient: 0.6,
    distance: 10,
    time_limit: 1.5,
};

test("the fallback mission matches the course window and is feasible", () => {
    const window = forceWindow(FALLBACK);
    assert.ok(Math.abs(window.min - 3.900) < 0.01, "F_min ≈ 3.90 N");
    assert.ok(Math.abs(window.max - 71.08) < 0.01, "F_max ≈ 71.08 N");
    assert.ok(Math.abs(minimumForceForTime(FALLBACK) - 22.22) < 0.01, "F_time = (m+M)·2D/t²");
    assert.equal(isSituationFeasible(FALLBACK), true, "fallback feasible");
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.block_mass >= 0.2 && challenge.block_mass <= 2, "block mass range");
        assert.ok(challenge.wedge_mass >= 1 && challenge.wedge_mass <= 8, "wedge mass range");
        assert.ok(challenge.incline_degrees >= 15 && challenge.incline_degrees <= 50, "angle range");
        assert.ok(challenge.friction_coefficient >= 0.3 && challenge.friction_coefficient <= 1, "friction range");
        assert.ok(challenge.distance >= 6 && challenge.distance <= 12, "distance range");
        assert.ok(challenge.time_limit >= 0.8 && challenge.time_limit <= 6, "time limit range");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("the winning grid force is fast enough AND keeps the crate stuck (Monte-Carlo)", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        const window = forceWindow(challenge);
        const grid = Math.ceil(
            Math.max(minimumForceForTime(challenge), window.min) / FORCE_STEP - 1e-9,
        ) * FORCE_STEP;
        assert.ok(grid <= FORCE_MAX, "grid F within the slider");
        const alpha = challenge.incline_degrees * Math.PI / 180;
        assert.equal(
            calc.isStuck(grid, challenge.block_mass, challenge.wedge_mass, alpha, challenge.friction_coefficient, GRAVITY),
            true,
            "the crate does not slide",
        );
        const acceleration = calc.systemAcceleration(grid, challenge.block_mass, challenge.wedge_mass);
        assert.ok(
            Math.sqrt(2 * challenge.distance / acceleration) <= challenge.time_limit + 1e-9,
            "the line is crossed in time",
        );
    }
});

test("isSituationFeasible rejects out-of-range or impossible missions", () => {
    assert.equal(isSituationFeasible({ ...FALLBACK, block_mass: 5 }), false, "block mass out of range");
    assert.equal(isSituationFeasible({ ...FALLBACK, time_limit: 0.4 }), false, "needs more force than the cone allows");
    assert.equal(isSituationFeasible({ ...FALLBACK, distance: 20 }), false, "distance out of range");
});

test("crossingTime interpolates the finish instant", () => {
    assert.equal(crossingTime({ time: 1, displacement: 8 }, { time: 2, displacement: 12 }, 10), 1.5, "midway");
    assert.equal(crossingTime({ time: 1, displacement: 8 }, { time: 2, displacement: 9 }, 10), null, "not crossed");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
