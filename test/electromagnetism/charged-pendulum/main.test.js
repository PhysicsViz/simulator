/*
 * main.test.js — Unit tests for the electrostatic-pendulum physics (calcul.js):
 * the course's two numeric answers (E ≈ 9.55×10⁵ V/m and ΔV ≈ 4.77×10⁴ V for
 * m = 1.5 g, q = 8.9 nC, L = 5 cm, φ = 30°), the equilibrium identity
 * tan φ = q·E/(m·g) and its inverse, the thread tension, the plate surface
 * density σ = ε₀·E and the sign behavior under reversed polarity.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/charged-pendulum/calcul.js";

const {
    VACUUM_PERMITTIVITY,
    electricField,
    fieldFromAngle,
    potentialFromAngle,
    equilibriumAngle,
    electricForce,
    threadTension,
    surfaceChargeDensity,
} = globalThis.charged_pendulum_calcul;

const GRAVITY = 9.81;
const MASS = 1.5e-3;
const CHARGE = 8.9e-9;
const PLATE_DISTANCE = 0.05;
const PHI = 30 * Math.PI / 180;

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("question 2: E = m·g·tan φ/q ≈ 9.55×10⁵ V/m", () => {
    assertClose(fieldFromAngle(MASS, GRAVITY, PHI, CHARGE), 9.546e5, 1e-3, "field for φ = 30°");
});

test("question 1: ΔV = E·L ≈ 4.77×10⁴ V", () => {
    assertClose(potentialFromAngle(MASS, GRAVITY, PHI, CHARGE, PLATE_DISTANCE), 4.773e4, 1e-3, "ΔV for φ = 30°");
});

test("equilibriumAngle inverts fieldFromAngle", () => {
    for (const degrees of [5, 30, 60, -45]) {
        const angle = degrees * Math.PI / 180;
        const field = fieldFromAngle(MASS, GRAVITY, angle, CHARGE);
        assertClose(equilibriumAngle(CHARGE, field, MASS, GRAVITY), angle, 1e-12, `roundtrip φ = ${degrees}°`);
    }
});

test("the equilibrium identity tan φ = q·E/(m·g) holds", () => {
    const field = fieldFromAngle(MASS, GRAVITY, PHI, CHARGE);
    assertClose(electricForce(CHARGE, field) / (MASS * GRAVITY), Math.tan(PHI), 1e-12, "horizontal/vertical ratio");
});

test("electricField is ΔV/L and reversed polarity flips the angle", () => {
    assertClose(electricField(4.773e4, 0.05), 9.546e5, 1e-3, "E = ΔV/L");
    const negative_angle = equilibriumAngle(CHARGE, electricField(-4.773e4, 0.05), MASS, GRAVITY);
    assertClose(negative_angle, -PHI, 1e-3, "negative ΔV deflects the other way");
});

test("thread tension T = m·g/cos φ ≈ 17 mN at 30°", () => {
    assertClose(threadTension(MASS, GRAVITY, PHI), 1.699e-2, 1e-3, "T for φ = 30°");
    assertClose(threadTension(MASS, GRAVITY, 0), MASS * GRAVITY, 1e-12, "T = m·g when vertical");
});

test("the tension components balance weight and electric force exactly", () => {
    const field = fieldFromAngle(MASS, GRAVITY, PHI, CHARGE);
    const tension = threadTension(MASS, GRAVITY, PHI);
    assertClose(tension * Math.cos(PHI), MASS * GRAVITY, 1e-12, "T·cos φ = m·g");
    assertClose(tension * Math.sin(PHI), electricForce(CHARGE, field), 1e-12, "T·sin φ = q·E");
});

test("surface charge density σ = ε₀·E ≈ 8.45 µC/m²", () => {
    const field = fieldFromAngle(MASS, GRAVITY, PHI, CHARGE);
    assertClose(surfaceChargeDensity(field), 8.452e-6, 1e-3, "σ for the course field");
    assertClose(surfaceChargeDensity(field), VACUUM_PERMITTIVITY * field, 1e-12, "σ = ε₀·E");
    assertClose(surfaceChargeDensity(-field), surfaceChargeDensity(field), 1e-12, "σ is a magnitude");
});

test("degenerate case φ = 0: no field, no force, no potential difference", () => {
    assert.equal(fieldFromAngle(MASS, GRAVITY, 0, CHARGE), 0, "E = 0");
    assert.equal(potentialFromAngle(MASS, GRAVITY, 0, CHARGE, PLATE_DISTANCE), 0, "ΔV = 0");
    assert.equal(equilibriumAngle(CHARGE, 0, MASS, GRAVITY), 0, "φ = 0");
});
