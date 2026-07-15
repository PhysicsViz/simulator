/*
 * main.test.js — Unit tests for the block-on-wedge physics (calcul.js): the
 * course answer F_min ≈ 3.90 N and F_max ≈ 71.09 N for m = 0.5 kg, M = 2 kg,
 * α = 40°, µs = 0.6; the no-slip window identities; the friction-cone test at
 * the boundaries; the exact sliding solution (zero relative acceleration at
 * the window edges, momentum balance, sign of the slide) and the piecewise
 * motion state.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/block-on-wedge/calcul.js";

const {
    frictionAngle,
    systemAcceleration,
    stuckNormal,
    requiredFriction,
    minAcceleration,
    maxAcceleration,
    minForce,
    maxForce,
    isStuck,
    slidingSolution,
    motionState,
} = globalThis.block_wedge_calcul;

const GRAVITY = 9.81;
const BLOCK = 0.5;
const WEDGE = 2;
const ALPHA = 40 * Math.PI / 180;
const MU = 0.6;

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("course answer: 3.90 N ≤ F ≤ 71.09 N", () => {
    assertClose(minForce(BLOCK, WEDGE, ALPHA, MU, GRAVITY), 3.900, 1e-3, "F_min = (m+M)·g·tan(α−φ)");
    assertClose(maxForce(BLOCK, WEDGE, ALPHA, MU, GRAVITY), 71.09, 1e-3, "F_max = (m+M)·g·tan(α+φ)");
});

test("the window accelerations are g·tan(α ∓ φ) with φ = atan µs", () => {
    const phi = frictionAngle(MU);
    assertClose(phi, Math.atan(0.6), 1e-12, "friction angle");
    assertClose(minAcceleration(ALPHA, MU, GRAVITY), GRAVITY * Math.tan(ALPHA - phi), 1e-12, "a_min");
    assertClose(maxAcceleration(ALPHA, MU, GRAVITY), GRAVITY * Math.tan(ALPHA + phi), 1e-12, "a_max");
});

test("the friction-cone test saturates exactly at the window edges", () => {
    for (const force of [minForce(BLOCK, WEDGE, ALPHA, MU, GRAVITY), maxForce(BLOCK, WEDGE, ALPHA, MU, GRAVITY)]) {
        const acceleration = systemAcceleration(force, BLOCK, WEDGE);
        const normal = stuckNormal(BLOCK, ALPHA, acceleration, GRAVITY);
        const friction = requiredFriction(BLOCK, ALPHA, acceleration, GRAVITY);
        assertClose(Math.abs(friction), MU * normal, 1e-9, `|f| = µs·N at F = ${force}`);
    }
});

test("the frictionless reference F₀ = (m+M)·g·tan α needs no friction", () => {
    const reference = (BLOCK + WEDGE) * GRAVITY * Math.tan(ALPHA);
    const acceleration = systemAcceleration(reference, BLOCK, WEDGE);
    assert.ok(Math.abs(requiredFriction(BLOCK, ALPHA, acceleration, GRAVITY)) < 1e-9, "f = 0 at F₀");
    assert.equal(isStuck(reference, BLOCK, WEDGE, ALPHA, MU, GRAVITY), true, "F₀ is inside the window");
});

test("isStuck classifies the three regimes", () => {
    assert.equal(isStuck(20, BLOCK, WEDGE, ALPHA, MU, GRAVITY), true, "F = 20 N holds");
    assert.equal(isStuck(2, BLOCK, WEDGE, ALPHA, MU, GRAVITY), false, "F = 2 N lets it slide down");
    assert.equal(isStuck(90, BLOCK, WEDGE, ALPHA, MU, GRAVITY), false, "F = 90 N throws it up");
});

test("steep angle + friction: no upper bound when α + φ ≥ 90°", () => {
    const steep = 65 * Math.PI / 180;
    assert.equal(maxForce(BLOCK, WEDGE, steep, 0.6, GRAVITY), Infinity, "α + φ ≥ 90° ⇒ F_max = ∞");
    assert.equal(isStuck(1000, BLOCK, WEDGE, steep, 0.6, GRAVITY), true, "any large F still holds");
});

test("shallow angle: F_min clamps to zero when α ≤ φ", () => {
    const shallow = 20 * Math.PI / 180;
    assert.equal(minForce(BLOCK, WEDGE, shallow, 0.6, GRAVITY), 0, "tan(α−φ) < 0 ⇒ F_min = 0");
    assert.equal(isStuck(0, BLOCK, WEDGE, shallow, 0.6, GRAVITY), true, "holds at rest without any push");
});

test("the sliding solution has zero relative acceleration at the window edges", () => {
    const down = slidingSolution(minForce(BLOCK, WEDGE, ALPHA, MU, GRAVITY), BLOCK, WEDGE, ALPHA, MU, GRAVITY, -1);
    assert.ok(Math.abs(down.relative_acceleration) < 1e-9, "s̈ = 0 at F_min (down branch)");
    assertClose(down.wedge_acceleration, minAcceleration(ALPHA, MU, GRAVITY), 1e-9, "A = a_min at F_min");
    const up = slidingSolution(maxForce(BLOCK, WEDGE, ALPHA, MU, GRAVITY), BLOCK, WEDGE, ALPHA, MU, GRAVITY, 1);
    assert.ok(Math.abs(up.relative_acceleration) < 1e-9, "s̈ = 0 at F_max (up branch)");
});

test("sliding directions match the regimes and N stays positive", () => {
    const weak = motionState(1, BLOCK, WEDGE, ALPHA, MU, GRAVITY, 0.5);
    assert.equal(weak.sliding, true, "F = 1 N slides");
    assert.ok(weak.slide_acceleration < 0, "slides down the incline");
    assert.ok(weak.normal > 0, "contact kept");
    const strong = motionState(100, BLOCK, WEDGE, ALPHA, MU, GRAVITY, 0.5);
    assert.equal(strong.sliding, true, "F = 100 N slides");
    assert.ok(strong.slide_acceleration > 0, "slides up the incline");
    assert.ok(strong.normal > 0, "contact kept");
});

test("momentum balance while sliding: total horizontal momentum change equals F·t", () => {
    for (const force of [1, 100]) {
        const state = motionState(force, BLOCK, WEDGE, ALPHA, MU, GRAVITY, 1);
        const block_velocity_x = state.wedge_velocity - state.slide_velocity * Math.cos(ALPHA);
        const momentum = WEDGE * state.wedge_velocity + BLOCK * block_velocity_x;
        assertClose(momentum, force * 1, 1e-9, `Σp_x = F·t at F = ${force}`);
    }
});

test("no-slip motion state is simple MRUA with the pair together", () => {
    const state = motionState(20, BLOCK, WEDGE, ALPHA, MU, GRAVITY, 2);
    assert.equal(state.sliding, false);
    assertClose(state.wedge_position, 0.5 * 8 * 4, 1e-12, "x = a·t²/2 with a = 8 m/s²");
    assert.equal(state.slide_displacement, 0, "no relative slide");
    assertClose(state.normal, stuckNormal(BLOCK, ALPHA, 8, GRAVITY), 1e-12, "N from the no-slip formula");
});
