/*
 * main.test.js — Unit tests for the spring–incline–pulley physics (calcul.js):
 * the course answer v ≈ 1.51 m/s after a 20 cm drop (m1 = 1 kg, m2 = 3 kg,
 * k = 16 N/m, θ = 25°, µc = 0.11), the agreement between the energy theorem
 * and the exact piecewise motion, the Coulomb-damped half-cycle mechanics
 * (turning points, amplitude loss 2f/k, sticking band) and the global energy
 * balance at rest.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/spring-pulley/calcul.js";

const {
    drivingForce,
    frictionMagnitude,
    normalForce,
    angularFrequency,
    speedAfterDrop,
    firstSwingMax,
    buildMotion,
    motionAt,
    ropeTension,
} = globalThis.spring_pulley_calcul;

const GRAVITY = 9.81;
const M1 = 1;
const M2 = 3;
const K = 16;
const THETA = 25 * Math.PI / 180;
const MU = 0.11;

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("course answer: v ≈ 1.51 m/s after a 20 cm drop", () => {
    assertClose(speedAfterDrop(M1, M2, K, THETA, MU, GRAVITY, 0.2), 1.507, 1e-3, "energy theorem");
});

test("the building blocks of the energy theorem", () => {
    assertClose(drivingForce(M1, M2, THETA, GRAVITY), 25.284, 1e-3, "F = m2·g − m1·g·sinθ");
    assertClose(frictionMagnitude(M1, THETA, MU, GRAVITY), 0.978, 1e-3, "f = µ·m1·g·cosθ");
    assertClose(normalForce(M1, THETA, GRAVITY), 8.8909, 1e-3, "N = m1·g·cosθ");
    assertClose(angularFrequency(K, M1, M2), 2, 1e-12, "ω = √(16/4)");
});

test("the exact motion agrees with the energy theorem during the first swing", () => {
    const motion = buildMotion(M1, M2, K, THETA, MU, GRAVITY);
    const center = motion.phases[0].center;
    const time_at_drop = Math.acos(1 - 0.2 / center) / motion.omega;
    const state = motionAt(motion, time_at_drop);
    assertClose(state.position, 0.2, 1e-9, "position reaches the drop");
    assertClose(Math.abs(state.velocity), speedAfterDrop(M1, M2, K, THETA, MU, GRAVITY, 0.2), 1e-9, "same speed");
});

test("first swing: harmonic about (F − f)/k, max drop 2·center", () => {
    const motion = buildMotion(M1, M2, K, THETA, MU, GRAVITY);
    assertClose(motion.phases[0].center, 1.5191, 1e-3, "shifted center");
    assertClose(firstSwingMax(M1, M2, K, THETA, MU, GRAVITY), 2 * motion.phases[0].center, 1e-12, "x_max = 2·c");
});

test("half-cycle mechanics: turning points at rest, amplitude loss 2f/k", () => {
    const motion = buildMotion(M1, M2, K, THETA, MU, GRAVITY);
    assert.ok(motion.phases.length >= 3, "several half-cycles before sticking");
    const half_period = Math.PI / motion.omega;
    for (let i = 1; i < Math.min(motion.phases.length, 5); i++) {
        const boundary_state = motionAt(motion, motion.phases[i].start_time - 1e-9);
        assert.ok(Math.abs(boundary_state.velocity) < 1e-6, `at rest at turning point ${i}`);
        assertClose(motion.phases[i].start_time, i * half_period, 1e-9, "half-period spacing");
    }
    const amplitude_1 = Math.abs(motion.phases[0].start_position - motion.phases[0].center);
    const amplitude_2 = Math.abs(motion.phases[1].start_position - motion.phases[1].center);
    assertClose(
        amplitude_1 - amplitude_2,
        2 * frictionMagnitude(M1, THETA, MU, GRAVITY) / K,
        1e-9,
        "Coulomb amplitude loss per half-cycle",
    );
});

test("the system sticks inside the static band |F − k·x| ≤ f", () => {
    const motion = buildMotion(M1, M2, K, THETA, MU, GRAVITY);
    const residual = Math.abs(drivingForce(M1, M2, THETA, GRAVITY) - K * motion.rest_position);
    assert.ok(residual <= frictionMagnitude(M1, THETA, MU, GRAVITY) + 1e-9, "stuck in the band");
    const final_state = motionAt(motion, motion.total_duration + 5);
    assertClose(final_state.position, motion.rest_position, 1e-12, "stays at rest");
    assert.equal(final_state.moving, false, "flagged at rest");
});

test("global energy balance at rest: F·x_f = ½·k·x_f² + f·(total path)", () => {
    const motion = buildMotion(M1, M2, K, THETA, MU, GRAVITY);
    let total_path = 0;
    for (const phase of motion.phases) {
        total_path += 2 * Math.abs(phase.center - phase.start_position);
    }
    const force = drivingForce(M1, M2, THETA, GRAVITY);
    const friction = frictionMagnitude(M1, THETA, MU, GRAVITY);
    assertClose(
        force * motion.rest_position,
        K * motion.rest_position * motion.rest_position / 2 + friction * total_path,
        1e-9,
        "all released energy ends in the spring or in friction heat",
    );
});

test("rope tension: T = m2·g at rest, m2·(g − a) while moving", () => {
    assertClose(ropeTension(M2, GRAVITY, 0), M2 * GRAVITY, 1e-12, "static tension");
    const motion = buildMotion(M1, M2, K, THETA, MU, GRAVITY);
    const state = motionAt(motion, 0.2);
    assert.ok(ropeTension(M2, GRAVITY, state.acceleration) < M2 * GRAVITY, "lighter while accelerating down");
});

test("heavy friction: the system never starts (F ≤ f)", () => {
    const motion = buildMotion(3, 1.4, 16, 60 * Math.PI / 180, 0.8, GRAVITY);
    assert.equal(motion.phases.length, 0, "no half-cycle");
    assert.equal(motion.rest_position, 0, "stays at x = 0");
    assert.equal(speedAfterDrop(3, 1.4, 16, 60 * Math.PI / 180, 0.8, GRAVITY, 0.2), 0, "no speed anywhere");
});
