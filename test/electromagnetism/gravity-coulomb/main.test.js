/*
 * main.test.js — Unit tests for the gravity–Coulomb physics (calcul.js):
 * force laws, equilibrium charge q = m·√(G/k) (the course's three questions),
 * exact radial-motion time/inversion/energy relations, and a numerical
 * leapfrog cross-check of the closed-form solution.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/gravity-coulomb/calcul.js";

const {
    GRAVITATIONAL_CONSTANT,
    COULOMB_CONSTANT,
    ELEMENTARY_CHARGE,
    gravityForce,
    coulombForce,
    forceCoefficient,
    netAttraction,
    equilibriumCharge,
    elementaryChargeCount,
    relativeMu,
    separationTime,
    contactTime,
    separationAt,
    relativeSpeed,
    separationRate,
    relativeAcceleration,
} = globalThis.gravity_coulomb_calcul;

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("gravityForce and coulombForce follow the inverse-square laws", () => {
    assertClose(gravityForce(1000, 10), 6.674e-7, 1e-12, "G·1000²/10²");
    assertClose(coulombForce(1e-7, 10), 8.988e9 * 1e-14 / 100, 1e-12, "k·q²/d²");
    assertClose(gravityForce(1000, 20), gravityForce(1000, 10) / 4, 1e-12, "doubling d divides F_g by 4");
});

test("equilibriumCharge satisfies k·q² = G·m² at any distance (question 1)", () => {
    for (const mass of [1, 250, 1000, 10000]) {
        const charge = equilibriumCharge(mass);
        assertClose(
            COULOMB_CONSTANT * charge * charge,
            GRAVITATIONAL_CONSTANT * mass * mass,
            1e-12,
            `k·q_eq² = G·m² for m = ${mass}`,
        );
    }
    assertClose(equilibriumCharge(1000), 8.617e-8, 1e-3, "one tonne needs about 86.17 nC");
});

test("same-sign charges are required for equilibrium (question 2)", () => {
    const mass = 1000;
    const charge = equilibriumCharge(mass);
    assert.ok(
        Math.abs(netAttraction(mass, charge, true, 10)) < 1e-9 * gravityForce(mass, 10),
        "same signs at q_eq balance (up to float rounding)",
    );
    assert.ok(netAttraction(mass, charge, false, 10) > 0, "opposite signs always attract");
    assert.ok(netAttraction(mass, charge * 0.5, true, 10) > 0, "below q_eq gravity wins");
    assert.ok(netAttraction(mass, charge * 2, true, 10) < 0, "above q_eq repulsion wins");
});

test("a one-tonne body needs about 5.4×10¹¹ elementary charges (question 3)", () => {
    const count = elementaryChargeCount(equilibriumCharge(1000));
    assertClose(count, equilibriumCharge(1000) / ELEMENTARY_CHARGE, 1e-12, "N = q/e");
    assertClose(count, 5.379e11, 1e-3, "N for m = 1 t");
});

test("forceCoefficient and relativeMu scale as expected", () => {
    assertClose(forceCoefficient(1000, 0, true), GRAVITATIONAL_CONSTANT * 1e6, 1e-12, "gravity only");
    assertClose(relativeMu(1000, 0, true), 2 * GRAVITATIONAL_CONSTANT * 1000, 1e-12, "μ = 2G·m at q = 0");
    assert.ok(
        Math.abs(relativeMu(1000, equilibriumCharge(1000), true)) < 1e-9 * relativeMu(1000, 0, true),
        "μ ≈ 0 at equilibrium (up to float rounding)",
    );
});

test("separationTime is zero at the start and matches the full free-fall time", () => {
    const mu = relativeMu(1000, 0, true);
    assert.equal(separationTime(10, mu, 10), 0, "t(d₀) = 0");
    assertClose(
        separationTime(10, mu, 0),
        (Math.PI / 2) * Math.sqrt(1000 / (2 * mu)),
        1e-9,
        "t(0) = (π/2)·√(d₀³/(2μ))",
    );
    const halfway = separationTime(10, mu, 5);
    assert.ok(halfway > 0 && halfway < separationTime(10, mu, 1), "t(d) grows as d shrinks");
});

test("separationAt inverts separationTime on both branches", () => {
    const attractive_mu = relativeMu(1000, 40e-9, true);
    for (const distance of [9.5, 7, 4, 1.5]) {
        const time = separationTime(10, attractive_mu, distance);
        assertClose(separationAt(10, attractive_mu, time), distance, 1e-6, `attractive roundtrip d = ${distance}`);
    }
    const repulsive_mu = relativeMu(1000, 300e-9, true);
    assert.ok(repulsive_mu < 0, "300 nC on a tonne is repulsive");
    for (const distance of [10.5, 14, 25]) {
        const time = separationTime(10, repulsive_mu, distance);
        assertClose(separationAt(10, repulsive_mu, time), distance, 1e-6, `repulsive roundtrip d = ${distance}`);
    }
});

test("separationAt stays at d₀ in equilibrium and before t = 0", () => {
    assert.equal(separationAt(10, 0, 1e9), 10, "exact equilibrium never moves");
    assert.equal(separationAt(10, 1e-7, 0), 10, "t = 0 returns d₀");
});

test("contactTime is finite only when the bodies attract", () => {
    assert.ok(Number.isFinite(contactTime(10, relativeMu(1000, 0, true), 1)), "gravity-only collapse");
    assert.equal(contactTime(10, relativeMu(1000, 300e-9, true), 1), Infinity, "net repulsion");
    assert.equal(contactTime(10, 0, 1), Infinity, "equilibrium");
});

test("relativeSpeed follows energy conservation on both branches", () => {
    const attractive_mu = relativeMu(1000, 0, true);
    assert.equal(relativeSpeed(10, attractive_mu, 10), 0, "starts at rest");
    assertClose(
        relativeSpeed(10, attractive_mu, 1),
        Math.sqrt(2 * attractive_mu * (1 - 0.1)),
        1e-12,
        "ḋ² = 2μ(1/d − 1/d₀)",
    );
    const repulsive_mu = relativeMu(1000, 300e-9, true);
    const escape_speed = Math.sqrt(2 * -repulsive_mu / 10);
    assert.ok(relativeSpeed(10, repulsive_mu, 1e6) < escape_speed, "bounded by the escape speed");
    assert.ok(relativeSpeed(10, repulsive_mu, 20) > 0, "gains speed while separating");
});

test("separationRate is negative while approaching, positive while separating", () => {
    assert.ok(separationRate(10, relativeMu(1000, 0, true), 5) < 0, "attraction closes the gap");
    assert.ok(separationRate(10, relativeMu(1000, 300e-9, true), 20) > 0, "repulsion opens the gap");
    assert.ok(separationRate(10, 0, 10) === 0, "equilibrium");
});

test("relativeAcceleration is −μ/d²", () => {
    assertClose(relativeAcceleration(2e-7, 10), -2e-9, 1e-12, "attractive: d̈ < 0");
    assertClose(relativeAcceleration(-2e-7, 10), 2e-9, 1e-12, "repulsive: d̈ > 0");
});

test("closed-form d(t) matches a leapfrog integration of d̈ = −μ/d²", () => {
    for (const mu of [relativeMu(1000, 40e-9, true), relativeMu(1000, 300e-9, true)]) {
        const initial_distance = 10;
        const end_time = mu > 0
            ? 0.8 * separationTime(initial_distance, mu, 1)
            : separationTime(initial_distance, mu, 30);
        const steps = 200000;
        const dt = end_time / steps;
        let distance = initial_distance;
        let velocity = 0;
        let acceleration = -mu / (distance * distance);
        for (let i = 0; i < steps; i++) {
            velocity += acceleration * dt / 2;
            distance += velocity * dt;
            acceleration = -mu / (distance * distance);
            velocity += acceleration * dt / 2;
        }
        assertClose(
            separationAt(initial_distance, mu, end_time),
            distance,
            1e-4,
            `leapfrog cross-check, μ = ${mu}`,
        );
    }
});
