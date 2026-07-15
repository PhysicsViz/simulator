/*
 * main.test.js — Unit tests for the hanging-sign statics (calcul.js), anchored
 * on the classroom exercise: m1 = 3 kg, m2 = 2 kg, L = 1.2 m, theta = 60°,
 * hooks 0.72 m apart with the right one 0.20 m from the bar's end.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/statics-sign/calcul.js";

const {
    degToRad,
    hookPositions,
    cableTension,
    pivotForceX,
    pivotForceY,
    forceMagnitude,
} = globalThis.statics_calcul;

/* assertClose: numeric comparison within a tolerance */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

const G = 9.81;

test("hookPositions reproduces the classroom geometry", () => {
    // sign centered at 0.64 m, hooks 0.72 m apart → 0.28 m and 1.00 m from the pivot
    const hooks = hookPositions(1.2, 0.64, 0.72);
    assertClose(hooks.left, 0.28, 1e-12, "left hook");
    assertClose(hooks.right, 1.0, 1e-12, "right hook (0.20 m from the end)");
});

test("hookPositions keeps the hooks on the bar", () => {
    const hooks = hookPositions(1.2, 0.1, 0.72);
    assert.ok(hooks.left >= 0.02, "clamped to the bar");
    assert.ok(hooks.right <= 1.18, "clamped to the bar");
});

test("cable tension matches the classroom answer T ≈ 51.0 N", () => {
    const tension = cableTension(3, 2, 1.2, degToRad(60), 0.28, 1.0, G);
    assertClose(tension, 51.012, 0.01, "T");
});

test("pivot force matches the classroom answer R ≈ 50.1 N", () => {
    const tension = cableTension(3, 2, 1.2, degToRad(60), 0.28, 1.0, G);
    const pivot_x = pivotForceX(tension, degToRad(60));
    const pivot_y = pivotForceY(3, 2, tension, degToRad(60), G);
    assertClose(pivot_x, 44.178, 0.01, "R_x = T·sin θ");
    assertClose(pivot_y, 23.544, 0.01, "R_y = (m1+m2)·g − T·cos θ");
    assertClose(forceMagnitude(pivot_x, pivot_y), 50.06, 0.02, "|R|");
});

test("the moment balance about the pivot closes to zero", () => {
    const angle = degToRad(60);
    const hooks = hookPositions(1.2, 0.64, 0.72);
    const tension = cableTension(3, 2, 1.2, angle, hooks.left, hooks.right, G);
    const residual = tension * Math.cos(angle) * 1.2
        - 2 * G * 0.6
        - (3 * G / 2) * (hooks.left + hooks.right);
    assertClose(residual, 0, 1e-9, "Σ M = 0");
});

test("the force balance closes to zero (vertical)", () => {
    const angle = degToRad(45);
    const hooks = hookPositions(1.2, 0.5, 0.6);
    const tension = cableTension(4, 1.5, 1.2, angle, hooks.left, hooks.right, G);
    const pivot_y = pivotForceY(4, 1.5, tension, angle, G);
    const residual = pivot_y + tension * Math.cos(angle) - (4 + 1.5) * G;
    assertClose(residual, 0, 1e-9, "Σ F_y = 0");
});

test("tension diverges as the cable becomes horizontal (θ → 90°)", () => {
    const near_vertical = cableTension(3, 2, 1.2, degToRad(20), 0.28, 1.0, G);
    const near_horizontal = cableTension(3, 2, 1.2, degToRad(85), 0.28, 1.0, G);
    assert.ok(near_horizontal > 5 * near_vertical, "cos θ in the denominator");
});

test("moving the sign toward the tip raises the tension", () => {
    const angle = degToRad(60);
    const near_pivot = cableTension(3, 2, 1.2, angle, 0.1, 0.4, G);
    const near_tip = cableTension(3, 2, 1.2, angle, 0.7, 1.1, G);
    assert.ok(near_tip > near_pivot, "larger moment arm");
});
