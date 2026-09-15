/*
 * main.test.js — Unit tests for the uniform circular motion physics (calcul.js):
 * angular velocity, period, position/velocity orthogonality, centripetal
 * acceleration and force, vertical-circle rope tension and the classic
 * minimum top speed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/uniform-circular-motion/calcul.js";

const {
    angularVelocity,
    angleAt,
    positionX,
    positionY,
    velocityX,
    velocityY,
    accelerationX,
    accelerationY,
    centripetalAcceleration,
    centripetalForce,
    period,
    ropeTension,
    minTopSpeed,
} = globalThis.circular_motion_calcul;

const EPSILON = 1e-9;

/* assertClose: strict numeric comparison within EPSILON */
function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < EPSILON, `${message}: expected ${expected}, got ${actual}`);
}

test("angularVelocity and period are consistent: omega·T = 2·pi", () => {
    const omega = angularVelocity(3, 1.5);
    assertClose(omega, 2, "omega = v/R");
    assertClose(omega * period(1.5, 3), 2 * Math.PI, "omega·T");
});

test("angleAt is linear in time (alpha = 0)", () => {
    assertClose(angleAt(0, 2, 3), 6, "theta = omega·t");
    assertClose(angleAt(1, 2, 0), 1, "theta0 at t = 0");
});

test("position stays on the circle and velocity is tangent", () => {
    const radius = 2;
    const speed = 5;
    for (const angle of [0, 0.7, 2.1, 4.4]) {
        const x = positionX(radius, angle);
        const y = positionY(radius, angle);
        assertClose(Math.hypot(x, y), radius, `radius at ${angle}`);
        const dot = x * velocityX(speed, angle) + y * velocityY(speed, angle);
        assertClose(dot, 0, `v ⊥ r at ${angle}`);
        assertClose(Math.hypot(velocityX(speed, angle), velocityY(speed, angle)), speed, `|v| at ${angle}`);
    }
});

test("acceleration points toward the center with magnitude v²/R", () => {
    const radius = 2;
    const speed = 4;
    const angle = 1.1;
    const ax = accelerationX(speed, radius, angle);
    const ay = accelerationY(speed, radius, angle);
    assertClose(Math.hypot(ax, ay), centripetalAcceleration(speed, radius), "|a| = v²/R");
    assertClose(ax * positionX(radius, angle) + ay * positionY(radius, angle), -radius * speed * speed / radius, "a antiparallel to r");
});

test("centripetal force is m·v²/R", () => {
    assertClose(centripetalForce(2, 3, 1.5), 12, "m=2, v=3, R=1.5");
});

test("rope tension at top and bottom of the vertical circle", () => {
    assertClose(ropeTension(1, 10, 2, 6, Math.PI / 2), 18 - 10, "top: m(v²/R − g)");
    assertClose(ropeTension(1, 10, 2, 6, -Math.PI / 2), 18 + 10, "bottom: m(v²/R + g)");
});

test("minTopSpeed reproduces the classic bucket result", () => {
    // Un seau d'eau décrit un cercle vertical de rayon 80 cm :
    // v_min = sqrt(g·R) = sqrt(9,81 × 0,8) ≈ 2,80 m/s
    assertClose(minTopSpeed(9.81, 0.8), Math.sqrt(9.81 * 0.8), "v_min = sqrt(g·R)");
    assert.ok(Math.abs(minTopSpeed(9.81, 0.8) - 2.8014) < 1e-3, "≈ 2,80 m/s");
    // and the water stays iff the tension at the top is non-negative
    assertClose(ropeTension(1, 9.81, 0.8, minTopSpeed(9.81, 0.8), Math.PI / 2), 0, "T_top = 0 at v_min");
});
