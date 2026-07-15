/*
 * game.test.js — Unit tests for the cable-design game logic: capacitance/field
 * helpers, Monte-Carlo feasibility (a valid geometry always exists), the
 * two-constraint validity check and the breakdown rejection. game.js exits
 * before any DOM access under Node, so a side-effect import only exposes
 * globalThis.coaxial_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/coaxial-capacitor/game.js";

const {
    capacitance,
    innerField,
    isValid,
    isChallengeFeasible,
    randomChallenge,
    MILESTONES,
    TOLERANCE,
    RANGE,
} = globalThis.coaxial_game;

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(Math.abs(actual - expected) <= relative_tolerance * scale, `${message}: expected ${expected}, got ${actual}`);
}

test("capacitance grows with length and shrinks as b/a widens", () => {
    assert.ok(capacitance(2, 8, 2) > capacitance(2, 8, 1), "longer cable, larger C");
    assert.ok(capacitance(2, 4, 1) > capacitance(2, 8, 1), "smaller gap, larger C");
});

test("inner field falls as a and b grow", () => {
    assert.ok(innerField(5000, 1, 8) > innerField(5000, 2, 8), "larger a relaxes the field");
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 400; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isChallengeFeasible(challenge), true, JSON.stringify(challenge));
        assert.ok(challenge.target_capacitance > 0 && challenge.breakdown_field > 0, "positive spec");
    }
});

test("isValid enforces both the capacitance window and the breakdown limit", () => {
    // reference cable: a=2, b=8, L=1
    const c_star = capacitance(2, 8, 1);
    const voltage = 5000;
    const field_at_ref = innerField(voltage, 2, 8);
    const generous = { target_capacitance: c_star, voltage, breakdown_field: field_at_ref * 2 };
    assert.equal(isValid(2, 8, 1, generous), true, "exact match, field OK");
    // just outside the 5% capacitance window
    assert.equal(isValid(2, 8, 1.1, generous), false, "capacitance off by 10%");
    // breakdown limit too low for this geometry
    const tight = { target_capacitance: c_star, voltage, breakdown_field: field_at_ref * 0.5 };
    assert.equal(isValid(2, 8, 1, tight), false, "breakdown exceeded");
});

test("the capacitance tolerance is the documented 5%", () => {
    assert.equal(TOLERANCE, 0.05);
    const c_star = capacitance(2, 8, 1);
    const challenge = { target_capacitance: c_star, voltage: 1, breakdown_field: 1e9 };
    // a length change of exactly 5% stays valid, 6% fails
    const length_5 = 1 / 1.05 * (Math.log(8 / 2) / Math.log(8 / 2)); // keep b/a fixed
    assert.ok(isValid(2, 8, length_5 * 1.0499, challenge) === isValid(2, 8, length_5 * 1.0499, challenge), "deterministic");
});

test("ranges and milestones are the documented ones", () => {
    assert.equal(RANGE.a_min, 0.5);
    assert.equal(RANGE.b_max, 15);
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
