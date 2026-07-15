/*
 * main.test.js — Unit tests for the electric field physics (calcul.js): the
 * three formulary laws (point 1/r², line 1/r, plate constant), directions for
 * both signs, superposition and the distance clamp.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/electric-field/calcul.js";

const {
    COULOMB_CONSTANT,
    VACUUM_PERMITTIVITY,
    pointChargeField,
    lineChargeField,
    plateField,
    totalField,
    fieldMagnitude,
} = globalThis.electric_field_calcul;

/* assertClose: numeric comparison within a relative tolerance */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-12);
    assert.ok(Math.abs(actual - expected) <= relative_tolerance * scale, `${message}: expected ${expected}, got ${actual}`);
}

test("point charge follows E = k·q/r² with the right direction", () => {
    const field = pointChargeField(1e-6, 0, 0, 1, 0);
    assertClose(field.x, COULOMB_CONSTANT * 1e-6, 1e-12, "E at 1 m");
    assertClose(field.y, 0, 1e-12, "purely radial");
    const far = pointChargeField(1e-6, 0, 0, 2, 0);
    assertClose(far.x, field.x / 4, 1e-12, "inverse square");
    const negative = pointChargeField(-1e-6, 0, 0, 1, 0);
    assertClose(negative.x, -field.x, 1e-12, "negative charge attracts");
});

test("line charge follows E = 2·k·λ/r perpendicular to the line", () => {
    const field = lineChargeField(1e-6, 0, 0, "vertical", 1, 0);
    assertClose(field.x, 2 * COULOMB_CONSTANT * 1e-6, 1e-12, "E at 1 m");
    assertClose(field.y, 0, 1e-12, "perpendicular to a vertical line");
    const far = lineChargeField(1e-6, 0, 0, "vertical", 2, 0);
    assertClose(far.x, field.x / 2, 1e-12, "inverse distance");
    const left = lineChargeField(1e-6, 0, 0, "vertical", -1, 0);
    assertClose(left.x, -field.x, 1e-12, "points away on both sides");
    const horizontal = lineChargeField(1e-6, 0, 0, "horizontal", 0, 1.5);
    assertClose(horizontal.y, 2 * COULOMB_CONSTANT * 1e-6 / 1.5, 1e-12, "horizontal line pushes along y");
});

test("plate field is uniform: E = σ/(2·ε₀) independent of distance", () => {
    const near = plateField(1e-6, 0, 0, "horizontal", 0, 0.5);
    const far = plateField(1e-6, 0, 0, "horizontal", 3, 4);
    assertClose(near.y, 1e-6 / (2 * VACUUM_PERMITTIVITY), 1e-12, "σ/(2ε₀)");
    assertClose(far.y, near.y, 1e-12, "independent of distance");
    const below = plateField(1e-6, 0, 0, "horizontal", 0, -1);
    assertClose(below.y, -near.y, 1e-12, "away on both sides");
});

test("superposition: the field between a dipole doubles, behind it cancels partially", () => {
    const elements = [
        { type: "charge", x: -1, y: 0, orientation: "vertical", value: 1e-6 },
        { type: "charge", x: 1, y: 0, orientation: "vertical", value: -1e-6 },
    ];
    const middle = totalField(elements, 0, 0);
    assertClose(middle.x, 2 * COULOMB_CONSTANT * 1e-6, 1e-12, "both push toward the negative charge");
    assertClose(middle.y, 0, 1e-9, "symmetry");
    const probe = totalField(elements, 0, 1);
    assertClose(probe.y, 0, 1e-9, "y components cancel on the axis of symmetry");
});

test("the field stays finite at a source (distance clamp)", () => {
    const field = pointChargeField(1e-6, 0, 0, 0.001, 0);
    assert.ok(Number.isFinite(field.x) && Number.isFinite(field.y), "finite");
    assert.ok(fieldMagnitude(field) <= COULOMB_CONSTANT * 1e-6 / (0.05 * 0.05) + 1e-6, "clamped magnitude");
});

test("probes and unknown types do not contribute to the field", () => {
    const elements = [
        { type: "probe", x: 0, y: 0, orientation: "vertical", value: 1 },
        { type: "charge", x: 1, y: 0, orientation: "vertical", value: 1e-6 },
    ];
    const field = totalField(elements, 2, 0);
    assertClose(field.x, COULOMB_CONSTANT * 1e-6, 1e-12, "only the charge counts");
});
