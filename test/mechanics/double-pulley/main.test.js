/*
 * main.test.js — Unit tests for the two-radius pulley physics (calcul.js):
 * the course's numeric answers (α, a1, a2, T1, T2, meeting time for m1 = 1 kg,
 * m2 = 3 kg, R1 = 5 cm, R2 = 10 cm, I = 0.2 kg·m², h = 2 m), the rotation
 * equation identity, equilibrium and reversed-motion cases, MRUA kinematics
 * and floor times.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/double-pulley/calcul.js";

const {
    angularAcceleration,
    accelerationBlock1,
    accelerationBlock2,
    tensionRope1,
    tensionRope2,
    meetingTime,
    positionBlock1,
    positionBlock2,
    verticalVelocityBlock1,
    verticalVelocityBlock2,
    angularVelocity,
    rotationAngle,
    floorTimeBlock1,
    floorTimeBlock2,
} = globalThis.double_pulley_calcul;

const GRAVITY = 9.81;

/* course values: m1 = 1, m2 = 3, R1 = 0.05, R2 = 0.10, I = 0.2, h = 2 */
const course_alpha = angularAcceleration(1, 3, 0.05, 0.10, 0.2, GRAVITY);
const course_a1 = accelerationBlock1(course_alpha, 0.05);
const course_a2 = accelerationBlock2(course_alpha, 0.10);

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("course numbers: α ≈ 10.55 rad/s², a1 ≈ 0.53 m/s², a2 ≈ 1.05 m/s²", () => {
    assertClose(course_alpha, 10.548, 1e-3, "α = 9.81·0.25/0.2325");
    assertClose(course_a1, 0.5274, 1e-3, "a1 = α·R1");
    assertClose(course_a2, 1.0548, 1e-3, "a2 = α·R2");
});

test("course numbers: T1 ≈ 10.34 N and T2 ≈ 26.27 N", () => {
    assertClose(tensionRope1(1, course_a1, GRAVITY), 10.337, 1e-3, "T1 = m1·(g + a1)");
    assertClose(tensionRope2(3, course_a2, GRAVITY), 26.266, 1e-3, "T2 = m2·(g − a2)");
});

test("course numbers: the blocks are level at t ≈ 1.59 s", () => {
    assertClose(meetingTime(2, course_a1, course_a2), 1.590, 1e-3, "t = √(2h/(a1+a2))");
});

test("the rotation equation I·α = T2·R2 − T1·R1 holds exactly", () => {
    const torque = tensionRope2(3, course_a2, GRAVITY) * 0.10 - tensionRope1(1, course_a1, GRAVITY) * 0.05;
    assertClose(0.2 * course_alpha, torque, 1e-12, "net torque equals I·α");
});

test("equilibrium when m1·R1 = m2·R2: no motion, tensions are the weights", () => {
    const alpha = angularAcceleration(6, 3, 0.10, 0.20, 0.2, GRAVITY);
    assert.equal(alpha, 0, "m1·R1 = m2·R2 balances the pulley");
    assert.equal(tensionRope1(6, 0, GRAVITY), 6 * GRAVITY, "T1 = m1·g at rest");
    assert.equal(tensionRope2(3, 0, GRAVITY), 3 * GRAVITY, "T2 = m2·g at rest");
    assert.equal(meetingTime(2, 0, 0), Infinity, "the blocks never meet");
});

test("reversed motion when m1·R1 > m2·R2: block 1 descends, no meeting", () => {
    const alpha = angularAcceleration(10, 1, 0.20, 0.05, 0.2, GRAVITY);
    assert.ok(alpha < 0, "the pulley turns the other way");
    const acceleration_1 = accelerationBlock1(alpha, 0.20);
    const acceleration_2 = accelerationBlock2(alpha, 0.05);
    assert.ok(acceleration_1 < 0 && acceleration_2 < 0, "block 1 down, block 2 up");
    assert.equal(meetingTime(2, acceleration_1, acceleration_2), Infinity, "the gap grows");
    assert.ok(Number.isFinite(floorTimeBlock1(0.5, acceleration_1)), "block 1 lands");
    assert.equal(floorTimeBlock2(0.5, 2, acceleration_2), Infinity, "block 2 rises");
});

test("block accelerations stay below g (the ropes stay taut)", () => {
    for (const [m1, m2, r1, r2, inertia] of [[0.1, 10, 0.01, 0.30, 0.01], [10, 0.1, 0.20, 0.01, 0.01]]) {
        const alpha = angularAcceleration(m1, m2, r1, r2, inertia, GRAVITY);
        assert.ok(Math.abs(accelerationBlock1(alpha, r1)) < GRAVITY, "|a1| < g");
        assert.ok(Math.abs(accelerationBlock2(alpha, r2)) < GRAVITY, "|a2| < g");
        assert.ok(tensionRope1(m1, accelerationBlock1(alpha, r1), GRAVITY) > 0, "T1 > 0");
        assert.ok(tensionRope2(m2, accelerationBlock2(alpha, r2), GRAVITY) > 0, "T2 > 0");
    }
});

test("the blocks are at the same height at the meeting time", () => {
    const meeting = meetingTime(2, course_a1, course_a2);
    const height_1 = positionBlock1(0.5, course_a1, meeting);
    const height_2 = positionBlock2(0.5, 2, course_a2, meeting);
    assertClose(height_1, height_2, 1e-12, "y1(t*) = y2(t*)");
    assertClose(height_1, 0.5 + 2 * course_a1 / (course_a1 + course_a2), 1e-12, "crossing height");
});

test("MRUA kinematics from rest", () => {
    assertClose(positionBlock1(0.5, 0.6, 2), 0.5 + 0.6 * 2, 1e-12, "y1 = y10 + a1·t²/2");
    assertClose(positionBlock2(0.5, 2, 1.0, 1), 2, 1e-12, "y2 = y10 + h − a2·t²/2");
    assertClose(verticalVelocityBlock1(0.6, 2), 1.2, 1e-12, "ẏ1 = a1·t");
    assertClose(verticalVelocityBlock2(1.0, 2), -2, 1e-12, "ẏ2 = −a2·t");
    assertClose(angularVelocity(10.5, 0.5), 5.25, 1e-12, "ω = α·t");
    assertClose(rotationAngle(10.5, 2), 21, 1e-12, "θ = α·t²/2");
});

test("floor times bring each block exactly to y = 0", () => {
    const time_1 = floorTimeBlock1(0.5, -0.4);
    assert.ok(Math.abs(positionBlock1(0.5, -0.4, time_1)) < 1e-12, "block 1 lands at y = 0");
    const time_2 = floorTimeBlock2(0.5, 2, 1.0548);
    assert.ok(Math.abs(positionBlock2(0.5, 2, 1.0548, time_2)) < 1e-12, "block 2 lands at y = 0");
    assert.equal(floorTimeBlock1(0.5, 0.4), Infinity, "a rising block never lands");
});
