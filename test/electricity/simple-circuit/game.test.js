/*
 * game.test.js — Unit tests for the lighthouse-lamp game logic: the ±5 %
 * verdict edges, challenge generation bounds, Monte-Carlo feasibility (a
 * 0.1 Ω slider-grid R always lights the lamp) and the two-solution property.
 * game.js exits before any DOM access under Node, so a side-effect import
 * (after calcul.js, which it reads) only exposes
 * globalThis.simple_circuit_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electricity/simple-circuit/calcul.js";
import "../../../src/electricity/simple-circuit/game.js";

const calc = globalThis.simple_circuit_calcul;
const {
    lampVerdict,
    winningLoads,
    isSituationFeasible,
    randomChallenge,
    MILESTONES,
    TOLERANCE,
} = globalThis.simple_circuit_game;

test("lampVerdict applies the ±5 % window", () => {
    assert.equal(lampVerdict(8, 8), "lit", "exactly rated");
    assert.equal(lampVerdict(7.6, 8), "lit", "exactly −5 %");
    assert.equal(lampVerdict(8.4, 8), "lit", "exactly +5 %");
    assert.equal(lampVerdict(8.5, 8), "burned", "above +5 %");
    assert.equal(lampVerdict(7.5, 8), "dim", "below −5 %");
    assert.equal(TOLERANCE, 0.05, "documented tolerance");
});

test("the fallback mission has winning loads on both sides of R = r", () => {
    const challenge = { emf: 12, internal_resistance: 2, rated_power: 8 };
    assert.equal(isSituationFeasible(challenge), true, "fallback feasible");
    const loads = winningLoads(challenge);
    assert.ok(loads.some((load) => load < 2), "a winning R below r");
    assert.ok(loads.some((load) => load > 2), "a winning R above r");
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.emf >= 6 && challenge.emf <= 24, "EMF range");
        assert.ok(challenge.internal_resistance >= 0.5 && challenge.internal_resistance <= 6, "r range");
        assert.ok(challenge.rated_power >= 1, "meaningful rated power");
        assert.ok(
            challenge.rated_power <= 0.88 * calc.maxLoadPower(challenge.emf, challenge.internal_resistance),
            "rated power keeps a margin below P_max",
        );
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("every winning load really lights the lamp (Monte-Carlo)", () => {
    for (let i = 0; i < 100; i++) {
        const challenge = randomChallenge(Math.random);
        const loads = winningLoads(challenge);
        assert.ok(loads.length > 0, "at least one winning R");
        for (const load of loads) {
            const power = calc.loadPower(load, calc.current(challenge.emf, challenge.internal_resistance, load));
            assert.equal(lampVerdict(power, challenge.rated_power), "lit", `R = ${load} lights the lamp`);
        }
    }
});

test("isSituationFeasible rejects out-of-range or impossible lamps", () => {
    assert.equal(isSituationFeasible({ emf: 3, internal_resistance: 2, rated_power: 1 }), false, "EMF out of range");
    assert.equal(isSituationFeasible({ emf: 12, internal_resistance: 2, rated_power: 17 }), false, "too close to P_max");
    assert.equal(isSituationFeasible({ emf: 12, internal_resistance: 2, rated_power: 0.5 }), false, "rated power too small");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
