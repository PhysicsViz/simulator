/*
 * game.test.js — Unit tests for the atomic-generator game logic: the target
 * tolerance, the (R, v) solution line, challenge generation bounds,
 * Monte-Carlo feasibility (a slider-grid pair always produces the target)
 * and the checker's rejections. game.js exits before any DOM access under
 * Node, so a side-effect import (after calcul.js, which it reads) only
 * exposes globalThis.electron_orbit_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/electron-orbit/calcul.js";
import "../../../src/electromagnetism/electron-orbit/game.js";

const {
    currentFor,
    isTargetMet,
    roundSignificant,
    winningPairs,
    isSituationFeasible,
    randomChallenge,
    MILESTONES,
    TOLERANCE,
} = globalThis.electron_orbit_game;

test("currentFor reproduces the course setup: 53 pm and 2200 km/s give ≈ 1.058 mA", () => {
    const current = currentFor(53, 2200);
    assert.ok(Math.abs(current - 1.058e-3) / 1.058e-3 < 1e-3, `got ${current}`);
});

test("isTargetMet applies the ±2 % tolerance", () => {
    assert.equal(isTargetMet(1.02e-3, 1e-3), true, "exactly +2 %");
    assert.equal(isTargetMet(0.98e-3, 1e-3), true, "exactly −2 %");
    assert.equal(isTargetMet(1.03e-3, 1e-3), false, "+3 % fails");
    assert.equal(TOLERANCE, 0.02, "documented tolerance");
});

test("roundSignificant keeps the requested number of digits", () => {
    assert.equal(roundSignificant(1.0584e-3, 4), 1.058e-3);
    assert.equal(roundSignificant(123456, 3), 123000);
    assert.equal(roundSignificant(0, 4), 0);
});

test("the fallback target has many winning pairs along the (R, v) line", () => {
    const challenge = { target_amps: roundSignificant(currentFor(53, 2200), 4) };
    const pairs = winningPairs(challenge);
    assert.ok(pairs.length > 10, "a whole line of solutions");
    for (const pair of pairs.slice(0, 20)) {
        assert.equal(
            isTargetMet(currentFor(pair.radius_picometers, pair.speed_kilometers), challenge.target_amps),
            true,
            JSON.stringify(pair),
        );
    }
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.target_amps >= 5e-5 && challenge.target_amps <= 2e-2, "target range");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 300; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("isSituationFeasible rejects out-of-range targets", () => {
    assert.equal(isSituationFeasible({ target_amps: 1e-6 }), false, "below the reachable range");
    assert.equal(isSituationFeasible({ target_amps: 0.1 }), false, "above the reachable range");
    assert.equal(isSituationFeasible({ target_amps: NaN }), false, "not a number");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
