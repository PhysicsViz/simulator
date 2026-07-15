/*
 * game.test.js — Unit tests for the RC-timer game logic: the trigger-time
 * design formula, the (R, C) product line, challenge generation bounds,
 * Monte-Carlo feasibility (a slider-grid pair always fires on time) and the
 * checker's rejections. game.js exits before any DOM access under Node, so a
 * side-effect import (after calcul.js, which it reads) only exposes
 * globalThis.rc_circuit_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electricity/rc-circuit/calcul.js";
import "../../../src/electricity/rc-circuit/game.js";

const {
    triggerFor,
    isTimingMet,
    winningPairs,
    isSituationFeasible,
    randomChallenge,
    MILESTONES,
    TOLERANCE,
} = globalThis.rc_circuit_game;

const FALLBACK = { emf: 9, threshold: 5.7, target_time: 1 };

test("the fallback timer fires at ≈ 1 s with R = 10 kΩ and C = 100 µF", () => {
    const trigger = triggerFor(FALLBACK, 10, 100);
    assert.ok(Math.abs(trigger - 1.0033) < 1e-3, `t = τ·ln(E/(E−u_s)), got ${trigger}`);
    assert.equal(isTimingMet(trigger, 1), true, "within ±5 %");
    assert.equal(isSituationFeasible(FALLBACK), true, "fallback feasible");
});

test("isTimingMet applies the ±5 % tolerance and rejects Infinity", () => {
    assert.equal(isTimingMet(1.05, 1), true, "exactly +5 %");
    assert.equal(isTimingMet(0.95, 1), true, "exactly −5 %");
    assert.equal(isTimingMet(1.06, 1), false, "+6 % fails");
    assert.equal(isTimingMet(Infinity, 1), false, "never firing fails");
    assert.equal(TOLERANCE, 0.05, "documented tolerance");
});

test("only the product R·C matters: many pairs along the hyperbola win", () => {
    const pairs = winningPairs(FALLBACK);
    assert.ok(pairs.length > 20, "a whole hyperbola of solutions");
    for (const pair of pairs.slice(0, 25)) {
        assert.equal(
            isTimingMet(triggerFor(FALLBACK, pair.resistance_kilohms, pair.capacitance_microfarads), 1),
            true,
            JSON.stringify(pair),
        );
    }
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.emf >= 6 && challenge.emf <= 24, "EMF range");
        assert.ok(challenge.threshold > 0.2 * challenge.emf, "threshold readable");
        assert.ok(challenge.threshold <= 0.85 * challenge.emf, "threshold reachable comfortably");
        assert.ok(challenge.target_time >= 0.5 && challenge.target_time <= 8, "target time range");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 300; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("isSituationFeasible rejects out-of-range or impossible timers", () => {
    assert.equal(isSituationFeasible({ emf: 4, threshold: 2, target_time: 1 }), false, "EMF out of range");
    assert.equal(isSituationFeasible({ emf: 9, threshold: 8.9, target_time: 1 }), false, "threshold too close to E");
    assert.equal(isSituationFeasible({ emf: 9, threshold: 5.7, target_time: 100 }), false, "target time out of range");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
