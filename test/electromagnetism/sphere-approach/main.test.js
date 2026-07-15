/*
 * main.test.js — Unit tests for the sphere-approach physics (calcul.js): the
 * course answer v_min ≈ 112.3 m/s (Q = 8 µC, q = 1 µC, m = 6×10⁻⁵ kg, turn
 * at R + 7 cm = 19 cm), the turning radius / minimum speed inversion, energy
 * conservation along the exact motion, the closed-form time primitive
 * against a numerical integration, the symmetric return and the collision
 * and blocked regimes.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/sphere-approach/calcul.js";

const {
    COULOMB_CONSTANT,
    potentialEnergy,
    repulsionForce,
    turningRadius,
    minimumSpeed,
    speedAt,
    inboundTime,
    motionAt,
} = globalThis.sphere_approach_calcul;

const Q = 8e-6;
const q = 1e-6;
const MASS = 6e-5;
const SPHERE_RADIUS = 0.12;
const LIMIT = 0.19;
const START = 2;

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("course answer: v_min ≈ 112.3 m/s to stay 7 cm above the surface", () => {
    assertClose(minimumSpeed(Q, q, MASS, LIMIT), 112.32, 1e-3, "v_min = √(2kQq/(m(R+d)))");
});

test("turning radius and minimum speed invert each other", () => {
    assertClose(turningRadius(Q, q, MASS, 112.32), LIMIT, 1e-3, "r_min at the course speed");
    for (const radius of [0.15, 0.19, 0.5]) {
        assertClose(
            turningRadius(Q, q, MASS, minimumSpeed(Q, q, MASS, radius)),
            radius,
            1e-12,
            `roundtrip at r = ${radius}`,
        );
    }
});

test("energy conservation defines the turning point", () => {
    const speed = 112.32;
    const turning = turningRadius(Q, q, MASS, speed);
    assertClose(0.5 * MASS * speed * speed, potentialEnergy(Q, q, turning), 1e-12, "½mv² = kQq/r_min");
    assertClose(speedAt(Q, q, MASS, speed, turning), 0, 1e-6, "v = 0 at the turning point");
});

test("the closed-form inbound time matches a numerical integration", () => {
    const speed = 150;
    const target = 0.3;
    let numeric = 0;
    const steps = 200000;
    for (let i = 0; i < steps; i++) {
        const radius = START - (START - target) * (i + 0.5) / steps;
        numeric += (START - target) / steps / speedAt(Q, q, MASS, speed, radius);
    }
    assertClose(inboundTime(Q, q, MASS, speed, START, target), numeric, 1e-4, "t(r) closed form");
});

test("the exact motion conserves energy and returns symmetrically", () => {
    const speed = 112.32;
    const total_energy = 0.5 * MASS * speed * speed;
    const turning = turningRadius(Q, q, MASS, speed);
    const turn_time = inboundTime(Q, q, MASS, speed, START, turning);
    for (const fraction of [0.2, 0.6, 0.95]) {
        const inbound = motionAt(Q, q, MASS, speed, START, SPHERE_RADIUS, turn_time * fraction);
        const outbound = motionAt(Q, q, MASS, speed, START, SPHERE_RADIUS, turn_time * (2 - fraction));
        assertClose(inbound.radius, outbound.radius, 1e-6, `mirror radii at fraction ${fraction}`);
        assertClose(
            0.5 * MASS * inbound.radial_velocity * inbound.radial_velocity + potentialEnergy(Q, q, inbound.radius),
            total_energy,
            1e-6,
            `energy conserved at fraction ${fraction}`,
        );
        assert.ok(inbound.radial_velocity < 0 && outbound.radial_velocity > 0, "signs of the two legs");
    }
});

test("too fast: the ball hits the sphere and freezes there", () => {
    const speed = 300;
    assert.ok(turningRadius(Q, q, MASS, speed) < SPHERE_RADIUS, "turning inside the sphere");
    const hit_time = inboundTime(Q, q, MASS, speed, START, SPHERE_RADIUS);
    const state = motionAt(Q, q, MASS, speed, START, SPHERE_RADIUS, hit_time * 1.2);
    assert.equal(state.phase, "impact", "impact phase");
    assertClose(state.radius, SPHERE_RADIUS, 1e-9, "frozen on the surface");
});

test("too slow to exist at the start radius: blocked", () => {
    const state = motionAt(Q, q, MASS, 10, START, SPHERE_RADIUS, 1);
    assert.equal(state.phase, "blocked", "r_min beyond r₀");
    assertClose(state.radius, START, 1e-12, "stays at the start");
});

test("force and acceleration on the way in", () => {
    assertClose(repulsionForce(Q, q, LIMIT), COULOMB_CONSTANT * Q * q / (LIMIT * LIMIT), 1e-12, "F = kQq/r²");
    const state = motionAt(Q, q, MASS, 112.32, START, SPHERE_RADIUS, 0);
    assertClose(state.radius, START, 1e-12, "starts at r₀");
    assert.ok(state.radial_velocity < 0, "moving inward");
});
