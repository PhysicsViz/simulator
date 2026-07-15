/*
 * main.test.js — Unit tests for the electron-orbit physics (calcul.js): the
 * course answer I = e·v/(2πR) ≈ 1.06 mA for R = 53 pm and v = 2200 km/s, the
 * period/frequency, the gate-crossing staircase whose average slope is the
 * current, the magnetic moment (close to the Bohr magneton) and the field at
 * the center (≈ 12.5 T).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/electron-orbit/calcul.js";

const {
    ELEMENTARY_CHARGE,
    BOHR_MAGNETON,
    period,
    frequency,
    averageCurrent,
    angularVelocity,
    centripetalAcceleration,
    completedTurns,
    chargePassed,
    magneticMoment,
    centerField,
    coulombForce,
} = globalThis.electron_orbit_calcul;

const RADIUS = 53e-12;
const SPEED = 2.2e6;

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("course answer: I = e·v/(2πR) ≈ 1.06 mA", () => {
    assertClose(averageCurrent(RADIUS, SPEED), 1.058e-3, 1e-3, "average current");
});

test("period and frequency of the revolution", () => {
    assertClose(period(RADIUS, SPEED), 1.5137e-16, 1e-3, "T = 2πR/v");
    assertClose(frequency(RADIUS, SPEED), 6.606e15, 1e-3, "f = 1/T");
    assertClose(frequency(RADIUS, SPEED) * period(RADIUS, SPEED), 1, 1e-12, "f·T = 1");
});

test("the current is the charge passed per unit time", () => {
    assertClose(averageCurrent(RADIUS, SPEED), ELEMENTARY_CHARGE / period(RADIUS, SPEED), 1e-12, "I = e/T");
    const many_turns = 1000;
    const elapsed = many_turns * period(RADIUS, SPEED);
    assertClose(
        chargePassed(RADIUS, SPEED, elapsed) / elapsed,
        averageCurrent(RADIUS, SPEED),
        1e-9,
        "Q/t converges to I",
    );
});

test("the gate staircase counts completed turns", () => {
    const T = period(RADIUS, SPEED);
    assert.equal(completedTurns(RADIUS, SPEED, 0), 0, "no crossing at t = 0");
    assert.equal(completedTurns(RADIUS, SPEED, 0.99 * T), 0, "not yet");
    assert.equal(completedTurns(RADIUS, SPEED, 1.01 * T), 1, "first crossing");
    assert.equal(completedTurns(RADIUS, SPEED, 2.5 * T), 2, "two and a half turns");
    assertClose(chargePassed(RADIUS, SPEED, 2.5 * T), 2 * ELEMENTARY_CHARGE, 1e-12, "Q = N·e");
});

test("kinematics: ω = v/R and a = v²/R", () => {
    assertClose(angularVelocity(RADIUS, SPEED), 4.1509e16, 1e-3, "ω");
    assertClose(centripetalAcceleration(RADIUS, SPEED), 9.132e22, 1e-3, "a");
});

test("the magnetic moment is close to the Bohr magneton", () => {
    const moment = magneticMoment(RADIUS, SPEED);
    assertClose(moment, 9.34e-24, 1e-2, "µ = I·π·R²");
    assert.ok(Math.abs(moment - BOHR_MAGNETON) / BOHR_MAGNETON < 0.02, "within 2 % of µ_B");
});

test("the field at the center is about 12.5 T", () => {
    assertClose(centerField(RADIUS, SPEED), 12.55, 1e-2, "B = µ₀·I/(2R)");
});

test("the Coulomb attraction holding the orbit", () => {
    assertClose(coulombForce(RADIUS), 8.21e-8, 1e-2, "F = k·e²/R²");
});
