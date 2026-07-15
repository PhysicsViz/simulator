/*
 * main.test.js — Unit tests for the charged-particle physics (calcul.js):
 * field superposition, electric force, acceleration, MRU/MRUA motion and
 * impact time on the plates.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/charged-particle/calcul.js";

const {
    totalField,
    electricForce,
    acceleration,
    positionX,
    positionY,
    velocityY,
    impactTime,
    speedMagnitude,
} = globalThis.charged_particle_calcul;

const EPSILON = 1e-9;

/* assertClose: strict numeric comparison within EPSILON */
function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < EPSILON, `${message}: expected ${expected}, got ${actual}`);
}

test("totalField is the algebraic sum of the plate contributions", () => {
    assertClose(totalField(500, 0), 500, "single plate");
    assertClose(totalField(500, -800), -300, "opposing plates");
});

test("electricForce is q·E, sign included", () => {
    assertClose(electricForce(10e-6, 1000), 0.01, "positive charge, upward field");
    assertClose(electricForce(-10e-6, 1000), -0.01, "negative charge flips the force");
});

test("acceleration is q·E/m", () => {
    assertClose(acceleration(10e-6, 1000, 0.001), 10, "q=10µC, E=1000 V/m, m=1 g");
    assertClose(acceleration(0, 1000, 0.001), 0, "neutral particle");
});

test("positionX is MRU and positionY is MRUA with v0y = 0", () => {
    assertClose(positionX(6, 2), 12, "x = u0·t");
    assertClose(positionY(2, 10, 1), 7, "y = y0 + a·t²/2");
    assertClose(positionY(2, 0, 5), 2, "straight flight");
});

test("velocityY grows linearly as a·t", () => {
    assertClose(velocityY(10, 0.5), 5, "a=10, t=0.5");
    assertClose(velocityY(-4, 2), -8, "downward acceleration");
});

test("impactTime hits the top plate when accelerating upward", () => {
    const time = impactTime(2, 10, 4);
    assertClose(positionY(2, 10, time), 4, "y(t_impact) = gap");
});

test("impactTime hits the bottom plate when accelerating downward", () => {
    const time = impactTime(2, -10, 4);
    assertClose(positionY(2, -10, time), 0, "y(t_impact) = 0");
});

test("impactTime is infinite for a straight flight", () => {
    assert.equal(impactTime(2, 0, 4), Infinity);
});

test("speedMagnitude is the Euclidean norm", () => {
    assertClose(speedMagnitude(3, 4), 5, "3-4-5 triangle");
});
