/*
 * main.test.js — Unit tests for the pendulum dynamics (calcul.js): equation of
 * motion, RK4 energy conservation, energy-based speed, tension, small-angle
 * period and bob position.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/pendulum/calcul.js";

const {
    degToRad,
    radToDeg,
    angularAcceleration,
    stepState,
    simulate,
    bobX,
    bobY,
    tangentialSpeed,
    speedFromEnergy,
    tension,
    smallAnglePeriod,
    mechanicalEnergy,
} = globalThis.pendulum_calcul;

/* assertClose: numeric comparison within a tolerance */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

test("degToRad and radToDeg are inverse conversions", () => {
    assertClose(degToRad(180), Math.PI, 1e-12, "180°");
    assertClose(radToDeg(Math.PI / 2), 90, 1e-12, "π/2");
});

test("angularAcceleration is −(g/L)·sin(theta)", () => {
    assertClose(angularAcceleration(0, 10, 2), 0, 1e-12, "equilibrium");
    assertClose(angularAcceleration(degToRad(90), 10, 2), -5, 1e-12, "horizontal");
    assertClose(angularAcceleration(degToRad(-90), 10, 2), 5, 1e-12, "restoring force sign");
});

test("bob position follows x = L·sin(theta), y = −L·cos(theta)", () => {
    assertClose(bobX(2, 0), 0, 1e-12, "x at rest");
    assertClose(bobY(2, 0), -2, 1e-12, "y at rest");
    assertClose(bobX(2, degToRad(90)), 2, 1e-12, "x horizontal");
    assertClose(bobY(2, degToRad(90)), 0, 1e-12, "y horizontal");
});

test("tangentialSpeed is L·omega, signed", () => {
    assertClose(tangentialSpeed(2, 3), 6, 1e-12, "positive");
    assertClose(tangentialSpeed(2, -1.5), -3, 1e-12, "negative");
});

test("speedFromEnergy: released from horizontal, speed at the bottom is sqrt(2·g·L)", () => {
    assertClose(speedFromEnergy(degToRad(90), 0, 0, 10, 2), Math.sqrt(40), 1e-12, "v bottom");
});

test("speedFromEnergy returns 0 beyond the reachable angle", () => {
    assertClose(speedFromEnergy(degToRad(30), 0, degToRad(60), 10, 2), 0, 1e-12, "unreachable");
});

test("tension at the bottom is m·(g + v²/L)", () => {
    const omega_bottom = Math.sqrt(40) / 2;
    assertClose(tension(1, 10, 2, 0, omega_bottom), 30, 1e-9, "released from horizontal");
    assertClose(tension(1, 10, 2, 0, 0), 10, 1e-12, "at rest T = m·g");
});

test("smallAnglePeriod is 2·pi·sqrt(L/g)", () => {
    assertClose(smallAnglePeriod(2, 9.81), 2 * Math.PI * Math.sqrt(2 / 9.81), 1e-12, "L=2, g=9.81");
});

test("RK4 integration conserves mechanical energy over a long run", () => {
    const initial_angle = degToRad(60);
    const initial_energy = mechanicalEnergy(initial_angle, 0, 9.81, 2);
    let state = { angle: initial_angle, angular_velocity: 0 };
    for (let i = 0; i < 4800; i++) {
        state = stepState(state, 9.81, 2, 1 / 240);
    }
    const final_energy = mechanicalEnergy(state.angle, state.angular_velocity, 9.81, 2);
    assertClose(final_energy, initial_energy, 1e-6, "energy after 20 s");
});

test("RK4 small-angle period matches 2·pi·sqrt(L/g) within 1%", () => {
    const trajectory = simulate(degToRad(2), 0, 9.81, 2, 1 / 240, 4800);
    let first_positive_crossing = null;
    let second_positive_crossing = null;
    for (let i = 1; i < trajectory.length; i++) {
        const crossed_upward = trajectory[i - 1].angle < 0 && trajectory[i].angle >= 0;
        if (crossed_upward && first_positive_crossing === null) {
            first_positive_crossing = trajectory[i].time;
        } else if (crossed_upward && second_positive_crossing === null) {
            second_positive_crossing = trajectory[i].time;
            break;
        }
    }
    const measured_period = second_positive_crossing - first_positive_crossing;
    const expected_period = smallAnglePeriod(2, 9.81);
    assertClose(measured_period, expected_period, expected_period * 0.01, "small-angle period");
});

test("simulate matches speedFromEnergy at the bottom crossing", () => {
    const trajectory = simulate(degToRad(80), 0, 9.81, 2, 1 / 240, 2400);
    let bottom_speed = 0;
    for (const sample of trajectory) {
        bottom_speed = Math.max(bottom_speed, Math.abs(tangentialSpeed(2, sample.angular_velocity)));
    }
    const expected_speed = speedFromEnergy(degToRad(80), 0, 0, 9.81, 2);
    assertClose(bottom_speed, expected_speed, 1e-3, "max speed equals bottom energy speed");
});
