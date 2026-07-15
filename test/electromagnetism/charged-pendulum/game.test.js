/*
 * game.test.js — Unit tests for the mystery-charge measurement game:
 * challenge generation bounds, Monte-Carlo feasibility (the deflection always
 * reaches 20° within the ΔV slider), the estimate grid always containing a
 * value within the ±5 % tolerance, the angle readout against the course
 * numbers and the verdict edges. game.js exits before any DOM access under
 * Node, so a side-effect import (after calcul.js, which it reads) only exposes
 * globalThis.charged_pendulum_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/charged-pendulum/calcul.js";
import "../../../src/electromagnetism/charged-pendulum/game.js";

const {
    angleAtVoltage,
    isSituationFeasible,
    randomChallenge,
    relativeError,
    isEstimateCorrect,
    MILESTONES,
    TOLERANCE,
    ESTIMATE_STEP,
    VOLTAGE_MAX,
} = globalThis.charged_pendulum_game;

test("angleAtVoltage reproduces the course setup: 30° at 47.73 kV", () => {
    const challenge = { mass_grams: 1.5, plate_centimeters: 5, hidden_nanocoulombs: 8.9 };
    const angle = angleAtVoltage(challenge, 4.773e4);
    assert.ok(Math.abs(angle - 30) < 0.05, `expected ≈30°, got ${angle}`);
    assert.equal(angleAtVoltage(challenge, 0), 0, "no voltage, no deflection");
});

test("the deterministic fallback mission is feasible", () => {
    assert.equal(
        isSituationFeasible({ mass_grams: 1.5, plate_centimeters: 5, hidden_nanocoulombs: 8.9 }),
        true,
    );
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.mass_grams >= 0.5 && challenge.mass_grams <= 5, "mass range");
        assert.ok(challenge.plate_centimeters >= 3 && challenge.plate_centimeters <= 10, "plate range");
        assert.ok(challenge.hidden_nanocoulombs >= 1 && challenge.hidden_nanocoulombs <= 45, "charge range");
    }
});

test("every generated challenge is feasible and measurable (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
        assert.ok(
            angleAtVoltage(challenge, VOLTAGE_MAX) >= 20,
            `deflection reaches 20° at the slider maximum: ${JSON.stringify(challenge)}`,
        );
    }
});

test("the estimate grid always contains a value within the tolerance (Monte-Carlo)", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        const grid_estimate = Math.round(challenge.hidden_nanocoulombs / ESTIMATE_STEP) * ESTIMATE_STEP;
        assert.equal(
            isEstimateCorrect(grid_estimate, challenge.hidden_nanocoulombs),
            true,
            `nearest grid estimate works for q = ${challenge.hidden_nanocoulombs}`,
        );
    }
});

test("isSituationFeasible rejects out-of-range or unmeasurable spheres", () => {
    assert.equal(isSituationFeasible({ mass_grams: 10, plate_centimeters: 5, hidden_nanocoulombs: 8.9 }), false, "mass out of range");
    assert.equal(isSituationFeasible({ mass_grams: 5, plate_centimeters: 10, hidden_nanocoulombs: 1 }), false, "deflection too small to read");
    assert.equal(isSituationFeasible({ mass_grams: 1.5, plate_centimeters: 5, hidden_nanocoulombs: 100 }), false, "charge out of range");
});

test("isEstimateCorrect applies the ±5 % tolerance", () => {
    assert.equal(isEstimateCorrect(10.5, 10), true, "exactly +5 %");
    assert.equal(isEstimateCorrect(9.5, 10), true, "exactly −5 %");
    assert.equal(isEstimateCorrect(10.6, 10), false, "+6 % fails");
    assert.equal(relativeError(11, 10), 0.1, "relative error math");
    assert.equal(TOLERANCE, 0.05, "documented tolerance");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
