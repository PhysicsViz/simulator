/*
 * game.test.js — Unit tests for the perfect-snapshot game logic: challenge
 * generation bounds, Monte-Carlo feasibility (a slider-grid (m1, I) pair
 * always puts the blocks level at the flash), the requiredInertia closed form
 * against the course values, flash interpolation and the alignment verdict.
 * game.js exits before any DOM access under Node, so a side-effect import
 * (after calcul.js, which it reads) only exposes globalThis.double_pulley_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/double-pulley/calcul.js";
import "../../../src/mechanics/double-pulley/game.js";

const calc = globalThis.double_pulley_calcul;
const {
    heightGapAtTime,
    requiredInertia,
    isSituationFeasible,
    randomChallenge,
    flashGap,
    isAligned,
    MILESTONES,
    TOLERANCE,
    GRAVITY,
} = globalThis.double_pulley_game;

/* courseChallenge: the exercise's own numbers, flash at their meeting time */
function courseChallenge() {
    const alpha = calc.angularAcceleration(1, 3, 0.05, 0.10, 0.2, GRAVITY);
    return {
        radius_1: 0.05,
        radius_2: 0.10,
        height_gap: 2,
        mass_2: 3,
        flash_time: calc.meetingTime(
            2,
            calc.accelerationBlock1(alpha, 0.05),
            calc.accelerationBlock2(alpha, 0.10),
        ),
    };
}

test("requiredInertia recovers the course inertia I = 0.2 kg·m² for m1 = 1 kg", () => {
    const inertia = requiredInertia(courseChallenge(), 1);
    assert.ok(Math.abs(inertia - 0.2) < 1e-9, `expected 0.2, got ${inertia}`);
});

test("the exact (m1, I) pair puts the blocks level at the flash", () => {
    const challenge = courseChallenge();
    const gap = heightGapAtTime(challenge, 1, 0.2, challenge.flash_time);
    assert.ok(Math.abs(gap) < 1e-9, `expected 0, got ${gap}`);
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.radius_1 >= 0.02 - 1e-12 && challenge.radius_1 <= 0.10 + 1e-12, "R1 range");
        assert.ok(challenge.radius_2 > challenge.radius_1 + 0.029, "R2 > R1 with margin");
        assert.ok(challenge.radius_2 <= 0.30 + 1e-12, "R2 within the slider range");
        assert.ok(challenge.height_gap >= 1 && challenge.height_gap <= 5, "h range");
        assert.ok(challenge.mass_2 >= 0.5 && challenge.mass_2 <= 10, "m2 range");
        assert.ok(challenge.flash_time >= 0.8 && challenge.flash_time <= 6, "flash time range");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("isSituationFeasible rejects impossible flash instants and geometries", () => {
    const impossible_flash = { ...courseChallenge(), flash_time: 0.01 };
    assert.equal(isSituationFeasible(impossible_flash), false, "flash too early for any inertia");
    const inverted_radii = { ...courseChallenge(), radius_2: 0.04 };
    assert.equal(isSituationFeasible(inverted_radii), false, "R2 must exceed R1");
    assert.equal(isSituationFeasible({ ...courseChallenge(), flash_time: -1 }), false, "negative flash time");
});

test("flashGap interpolates the heights at the flash instant", () => {
    const previous_state = { time: 1, height_1: 1.0, height_2: 2.0 };
    const state = { time: 2, height_1: 2.0, height_2: 1.0 };
    assert.equal(flashGap(previous_state, state, 1.5), 0, "crossing exactly at the flash");
    assert.equal(flashGap(previous_state, state, 1.25), 0.5, "interpolated gap");
    assert.equal(flashGap(previous_state, state, 2.5), null, "flash not reached yet");
    assert.equal(flashGap({ time: 3, height_1: 0, height_2: 0 }, { time: 4, height_1: 0, height_2: 0 }, 2.5), null, "flash already past");
});

test("isAligned applies the tolerance", () => {
    assert.equal(isAligned(TOLERANCE), true, "exactly at the tolerance");
    assert.equal(isAligned(TOLERANCE + 0.01), false, "just outside");
    assert.equal(isAligned(0), true, "perfect alignment");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
