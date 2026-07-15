/*
 * main.test.js — Unit tests for the inclined-plane physics (calcul.js): forces,
 * static equilibrium, piecewise integration against the analytic MRUA results,
 * stopping distance, slide-back behaviour and the bottom-corner clamp.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/inclined-plane/calcul.js";

const {
    degToRad,
    normalForce,
    kineticFriction,
    staysStopped,
    movingAcceleration,
    simulate,
    stoppingDistance,
    speedAtPosition,
} = globalThis.incline_calcul;

/* assertClose: numeric comparison within a tolerance */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

test("normal force and kinetic friction follow N = m·g·cos α and f = μ·N", () => {
    assertClose(normalForce(2, 10, degToRad(0)), 20, 1e-12, "flat ground");
    assertClose(normalForce(2, 10, degToRad(60)), 10, 1e-9, "steep slope");
    assertClose(kineticFriction(0.5, 10), 5, 1e-12, "f = μN");
});

test("static equilibrium holds iff tan α ≤ μ", () => {
    assert.equal(staysStopped(degToRad(20), 0.5), true, "tan 20° ≈ 0.36 ≤ 0.5");
    assert.equal(staysStopped(degToRad(30), 0.5), false, "tan 30° ≈ 0.58 > 0.5");
    assert.equal(staysStopped(degToRad(0), 0), true, "flat, no friction");
});

test("moving acceleration matches −g·(sin α ± μ·cos α)", () => {
    const angle = degToRad(30);
    assertClose(movingAcceleration(angle, 0.2, 10, 1), -10 * (0.5 + 0.2 * Math.sqrt(3) / 2), 1e-9, "going up");
    assertClose(movingAcceleration(angle, 0.2, 10, -1), -10 * (0.5 - 0.2 * Math.sqrt(3) / 2), 1e-9, "going down");
});

test("frictionless incline reproduces the analytic MRUA", () => {
    const angle = degToRad(30);
    const frames = simulate(6, angle, 0, 10, 1 / 240, 240);
    const expected_position = 6 * 1 - 0.5 * 10 * Math.sin(angle) * 1;
    assertClose(frames[240].position, expected_position, 1e-3, "s(1) = v0·t − g·sinα·t²/2");
    assertClose(frames[240].velocity, 6 - 10 * Math.sin(angle), 1e-3, "v(1) = v0 − g·sinα·t");
});

test("the block stops at the analytic stopping distance and holds when tan α ≤ μ", () => {
    const angle = degToRad(20);
    const mu = 0.5;
    const frames = simulate(5, angle, mu, 9.81, 1 / 240, 4800);
    const expected = stoppingDistance(5, angle, mu, 9.81);
    const final = frames[4800];
    assertClose(final.position, expected, 0.01, "final position");
    assertClose(final.velocity, 0, 1e-9, "at rest");
});

test("the block slides back down when tan α > μ and passes s = 0 with reduced speed", () => {
    const angle = degToRad(30);
    const mu = 0.2;
    const frames = simulate(5, angle, mu, 9.81, 1 / 240, 4800);
    let came_back = false;
    for (const frame of frames) {
        if (frame.time > 1 && frame.position <= 0 && frame.velocity < 0) {
            came_back = true;
            // friction dissipated energy on the way up AND down: |v| < v0
            assert.ok(Math.abs(frame.velocity) < 5, "slower than launch");
            assert.ok(Math.abs(frame.velocity) > 1, "still moving");
            break;
        }
    }
    assert.equal(came_back, true, "block came back through the start");
});

test("speedAtPosition matches the simulated crossing speed going up", () => {
    const angle = degToRad(25);
    const mu = 0.3;
    const frames = simulate(7, angle, mu, 9.81, 1 / 240, 2400);
    const target = 1.5;
    let measured = null;
    for (let i = 1; i < frames.length; i++) {
        if (frames[i - 1].position < target && frames[i].position >= target) {
            measured = frames[i].velocity;
            break;
        }
    }
    assert.ok(measured !== null, "crossed the target");
    assertClose(measured, speedAtPosition(7, target, angle, mu, 9.81), 0.02, "v at s = 1.5 m");
});

test("the bottom corner clamps the block", () => {
    const frames = simulate(-5, degToRad(30), 0.1, 9.81, 1 / 240, 2400, -2);
    const final = frames[2400];
    assertClose(final.position, -2, 1e-9, "rests at the corner");
    assertClose(final.velocity, 0, 1e-9, "no velocity at the corner");
});
