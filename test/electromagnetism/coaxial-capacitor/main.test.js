/*
 * main.test.js — Unit tests for the coaxial capacitor physics (calcul.js): the
 * formulary results for the field, potential, potential difference, boundary
 * condition, energy density, capacitance (geometry only) and stored energy,
 * plus the "uncharged outer tube" question (ΔV unchanged).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/coaxial-capacitor/calcul.js";

const {
    VACUUM_PERMITTIVITY,
    fieldAt,
    potentialAt,
    potentialDifference,
    surfaceChargeDensity,
    energyDensity,
    capacitance,
    storedEnergy,
} = globalThis.coaxial_calcul;

const TWO_PI_EPSILON = 2 * Math.PI * VACUUM_PERMITTIVITY;

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(Math.abs(actual - expected) <= relative_tolerance * scale, `${message}: expected ${expected}, got ${actual}`);
}

test("field between the conductors is λ/(2πε₀r), zero elsewhere", () => {
    const lambda = 1e-6;
    assertClose(fieldAt(lambda, 0.02, 0.08, 0.05, true), lambda / (TWO_PI_EPSILON * 0.05), 1e-12, "at r = 5 cm");
    assert.equal(fieldAt(lambda, 0.02, 0.08, 0.01, true), 0, "inside the inner metal");
    assert.equal(fieldAt(lambda, 0.02, 0.08, 0.1, true), 0, "outside the charged tube");
});

test("uncharged outer tube leaves a 1/r field beyond b", () => {
    const lambda = 1e-6;
    assertClose(fieldAt(lambda, 0.02, 0.08, 0.1, false), lambda / (TWO_PI_EPSILON * 0.1), 1e-12, "field survives outside");
});

test("potential with V(b) = 0 is λ/(2πε₀)·ln(b/r)", () => {
    const lambda = 1e-6;
    assert.equal(potentialAt(lambda, 0.02, 0.08, 0.08, true), 0, "V(b) = 0");
    assertClose(potentialAt(lambda, 0.02, 0.08, 0.04, true), (lambda / TWO_PI_EPSILON) * Math.log(2), 1e-12, "V at r = b/2");
    assertClose(potentialAt(lambda, 0.02, 0.08, 0.01, true), potentialAt(lambda, 0.02, 0.08, 0.02, true), 1e-12, "constant inside the inner metal");
});

test("V(a) − V(b) = λ/(2πε₀)·ln(b/a) matches the derivation", () => {
    const lambda = 1e-6;
    const expected = (lambda / TWO_PI_EPSILON) * Math.log(0.08 / 0.02);
    assertClose(potentialDifference(lambda, 0.02, 0.08), expected, 1e-12, "ΔV");
    // = V(a) − V(b) directly
    assertClose(potentialDifference(lambda, 0.02, 0.08), potentialAt(lambda, 0.02, 0.08, 0.02, true), 1e-12, "consistency");
});

test("the potential difference does NOT depend on the outer tube's charge (question 4)", () => {
    const lambda = 1e-6;
    const charged = potentialAt(lambda, 0.02, 0.08, 0.02, true) - potentialAt(lambda, 0.02, 0.08, 0.08, true);
    const uncharged = potentialAt(lambda, 0.02, 0.08, 0.02, false) - potentialAt(lambda, 0.02, 0.08, 0.08, false);
    assertClose(uncharged, charged, 1e-12, "V(a) − V(b) unchanged");
});

test("boundary condition at r = a: E(a⁺) = σ_a/ε₀", () => {
    const lambda = 1e-6;
    const sigma = surfaceChargeDensity(lambda, 0.02);
    assertClose(fieldAt(lambda, 0.02, 0.08, 0.02, true), sigma / VACUUM_PERMITTIVITY, 1e-9, "E(a⁺) = σ/ε₀");
});

test("energy density is ε₀·E²/2", () => {
    assertClose(energyDensity(1000), VACUUM_PERMITTIVITY * 1e6 / 2, 1e-12, "u at E = 1 kV/m");
});

test("capacitance is 2πε₀L/ln(b/a) and depends only on geometry", () => {
    const c = capacitance(0.02, 0.08, 1);
    assertClose(c, TWO_PI_EPSILON / Math.log(4), 1e-12, "C for L = 1 m");
    // independent of lambda: doubling the charge does not change C
    assertClose(capacitance(0.02, 0.08, 2), 2 * c, 1e-12, "C scales with L only");
});

test("stored energy equals ½·C·ΔV²", () => {
    const lambda = 1e-6;
    const c = capacitance(0.02, 0.08, 1);
    const dv = potentialDifference(lambda, 0.02, 0.08);
    assertClose(storedEnergy(lambda, 0.02, 0.08, 1), 0.5 * c * dv * dv, 1e-10, "U = ½CV²");
});
