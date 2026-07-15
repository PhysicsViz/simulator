/*
 * main.test.js — Unit tests for the mass-spring (trampoline) physics
 * (calcul.js): the course answer k = 2·m·g·(h+d)/d² ≈ 2.27×10⁴ N/m for
 * m = 68 kg, h = 3 m, d = 45 cm, the k ↔ d roundtrip, the exact piecewise
 * motion (phase continuity, energy conservation, contact duration), the peak
 * acceleration closed form and the h = 0 grazing case.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/mass-spring/calcul.js";

const {
    impactSpeed,
    freeFallTime,
    equilibriumCompression,
    angularFrequency,
    maxDepression,
    springConstantFromDepression,
    contactDuration,
    cyclePeriod,
    maxAcceleration,
    motionAt,
    energies,
} = globalThis.mass_spring_calcul;

const GRAVITY = 9.81;
const MASS = 68;
const HEIGHT = 3;
const DEPRESSION = 0.45;
const COURSE_STIFFNESS = springConstantFromDepression(MASS, GRAVITY, HEIGHT, DEPRESSION);

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("course answer: k = 2·m·g·(h+d)/d² ≈ 2.27×10⁴ N/m", () => {
    assertClose(COURSE_STIFFNESS, 22730, 1e-3, "trampoline stiffness");
});

test("k ↔ d roundtrip: maxDepression inverts springConstantFromDepression", () => {
    assertClose(maxDepression(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS), DEPRESSION, 1e-9, "d(k(d)) = d");
    for (const stiffness of [5000, 22730, 100000]) {
        const depression = maxDepression(MASS, GRAVITY, HEIGHT, stiffness);
        assertClose(
            springConstantFromDepression(MASS, GRAVITY, HEIGHT, depression),
            stiffness,
            1e-9,
            `k(d(k)) = k for k = ${stiffness}`,
        );
    }
});

test("energy conservation defines the lowest point: m·g·(h+d) = ½·k·d²", () => {
    const depression = maxDepression(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS);
    assertClose(
        MASS * GRAVITY * (HEIGHT + depression),
        COURSE_STIFFNESS * depression * depression / 2,
        1e-12,
        "energy balance at the lowest point",
    );
});

test("impact speed and free-fall time", () => {
    assertClose(impactSpeed(GRAVITY, HEIGHT), 7.672, 1e-3, "v = √(2gh)");
    assertClose(freeFallTime(GRAVITY, HEIGHT), Math.sqrt(6 / GRAVITY), 1e-12, "t = √(2h/g)");
});

test("equilibrium compression and angular frequency", () => {
    assertClose(equilibriumCompression(MASS, GRAVITY, COURSE_STIFFNESS), 0.02935, 1e-3, "x_eq = mg/k");
    assertClose(angularFrequency(COURSE_STIFFNESS, MASS), Math.sqrt(COURSE_STIFFNESS / MASS), 1e-12, "ω = √(k/m)");
});

test("the motion is continuous at the phase boundaries", () => {
    const fall = freeFallTime(GRAVITY, HEIGHT);
    const contact = contactDuration(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS);
    const epsilon = 1e-9;
    for (const boundary of [fall, fall + contact]) {
        const before = motionAt(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS, boundary - epsilon);
        const after = motionAt(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS, boundary + epsilon);
        assert.ok(Math.abs(before.height - after.height) < 1e-6, `height continuous at t = ${boundary}`);
        assert.ok(Math.abs(before.velocity - after.velocity) < 1e-4, `velocity continuous at t = ${boundary}`);
    }
});

test("the lowest point of the motion matches maxDepression", () => {
    let lowest = Infinity;
    const period = cyclePeriod(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS);
    for (let i = 0; i <= 20000; i++) {
        lowest = Math.min(lowest, motionAt(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS, (period * i) / 20000).height);
    }
    assertClose(-lowest, DEPRESSION, 1e-4, "sampled minimum equals d");
});

test("energy is conserved through all three phases", () => {
    const period = cyclePeriod(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS);
    for (const fraction of [0.1, 0.35, 0.5, 0.52, 0.55, 0.8, 0.99]) {
        const state = motionAt(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS, period * fraction);
        const energy = energies(MASS, GRAVITY, COURSE_STIFFNESS, state);
        assertClose(
            energy.kinetic + energy.gravitational + energy.elastic,
            MASS * GRAVITY * HEIGHT,
            1e-9,
            `E_tot = m·g·h at fraction ${fraction}`,
        );
    }
});

test("the mass returns to h with zero velocity at the end of the cycle", () => {
    const period = cyclePeriod(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS);
    const state = motionAt(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS, period - 1e-9);
    assertClose(state.height, HEIGHT, 1e-6, "back to the drop height");
    assert.ok(Math.abs(state.velocity) < 1e-3, "at rest at the top");
});

test("maxAcceleration matches k·d/m − g and the sampled peak", () => {
    const closed_form = maxAcceleration(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS);
    assertClose(closed_form, COURSE_STIFFNESS * DEPRESSION / MASS - GRAVITY, 1e-6, "a_max = k·d/m − g");
    let sampled = -Infinity;
    const period = cyclePeriod(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS);
    for (let i = 0; i <= 20000; i++) {
        sampled = Math.max(sampled, motionAt(MASS, GRAVITY, HEIGHT, COURSE_STIFFNESS, (period * i) / 20000).acceleration);
    }
    assertClose(sampled, closed_form, 1e-4, "sampled peak equals the closed form");
});

test("h = 0: permanent grazing contact oscillating down to 2·x_eq", () => {
    const stiffness = 5000;
    assertClose(maxDepression(MASS, GRAVITY, 0, stiffness), 2 * MASS * GRAVITY / stiffness, 1e-12, "d = 2·x_eq");
    const period = cyclePeriod(MASS, GRAVITY, 0, stiffness);
    assertClose(period, 2 * Math.PI / angularFrequency(stiffness, MASS), 1e-12, "full harmonic period");
    for (const fraction of [0.1, 0.5, 0.9]) {
        assert.equal(motionAt(MASS, GRAVITY, 0, stiffness, period * fraction).in_contact, true, "always in contact");
    }
});
