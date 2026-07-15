/*
 * main.test.js — Unit tests for the simple-circuit physics (calcul.js):
 * Pouillet's law, the terminal voltage, the power budget E·I = P_R + r·I²,
 * the efficiency, the impedance-matching maximum E²/(4r) at R = r, the
 * short/open-circuit extremes and the loadForPower inversion.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electricity/simple-circuit/calcul.js";

const {
    current,
    terminalVoltage,
    loadPower,
    internalPower,
    totalPower,
    efficiency,
    maxLoadPower,
    shortCircuitCurrent,
    internalFromPower,
    loadForPower,
} = globalThis.simple_circuit_calcul;

/* assertClose: absolute-tolerance numeric comparison */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

test("Pouillet's law: I = E/(r + R) = 1 A for the defaults", () => {
    assertClose(current(12, 2, 10), 1, 1e-12, "12/(2+10)");
});

test("terminal voltage U = E − r·I = R·I", () => {
    const circuit_current = current(12, 2, 10);
    assertClose(terminalVoltage(12, 2, circuit_current), 10, 1e-12, "U = 12 − 2·1");
    assertClose(terminalVoltage(12, 2, circuit_current), 10 * circuit_current, 1e-12, "U = R·I");
});

test("power budget: E·I = P_R + r·I²", () => {
    for (const load of [0.5, 2, 10, 40]) {
        const circuit_current = current(12, 2, load);
        assertClose(
            totalPower(12, circuit_current),
            loadPower(load, circuit_current) + internalPower(2, circuit_current),
            1e-12,
            `budget at R = ${load}`,
        );
    }
});

test("efficiency η = R/(R + r) = U/E", () => {
    assertClose(efficiency(10, 2), 10 / 12, 1e-12, "η for the defaults");
    const circuit_current = current(12, 2, 10);
    assertClose(efficiency(10, 2), terminalVoltage(12, 2, circuit_current) / 12, 1e-12, "η = U/E");
});

test("the load power peaks at R = r with P_max = E²/(4r)", () => {
    assertClose(maxLoadPower(12, 2), 18, 1e-12, "P_max = 144/8");
    const at_match = loadPower(2, current(12, 2, 2));
    assertClose(at_match, 18, 1e-12, "P(R = r) = P_max");
    assert.ok(loadPower(1.5, current(12, 2, 1.5)) < 18, "below the match");
    assert.ok(loadPower(3, current(12, 2, 3)) < 18, "above the match");
});

test("short-circuit and open-circuit extremes", () => {
    assertClose(shortCircuitCurrent(12, 2), 6, 1e-12, "I_cc = E/r");
    assertClose(terminalVoltage(12, 2, 0), 12, 1e-12, "U₀ = E at I = 0");
});

test("loadForPower returns the two loads around R = r", () => {
    const roots = loadForPower(12, 2, 8);
    assert.ok(roots !== null, "8 W < P_max is reachable");
    assert.ok(roots.low < 2 && roots.high > 2, "one root on each side of R = r");
    for (const load of [roots.low, roots.high]) {
        assertClose(loadPower(load, current(12, 2, load)), 8, 1e-9, `P(R = ${load}) = 8 W`);
    }
});

test("course problem Q1: r from E = 16 V, R = 4 Ω, P = 50 W is ≈ 0.53 Ω", () => {
    const internal = internalFromPower(16, 4, 50);
    assertClose(internal, 0.5255, 1e-3, "r = E·√(R/P) − R");
    assertClose(loadPower(4, current(16, internal, 4)), 50, 1e-9, "the recovered r reproduces the 50 W");
});

test("course problem Q2: the battery dissipates ≈ 6.57 W internally", () => {
    const internal = internalFromPower(16, 4, 50);
    const circuit_current = current(16, internal, 4);
    assertClose(internalPower(internal, circuit_current), 6.569, 1e-3, "P_r = r·I²");
    assertClose(totalPower(16, circuit_current), 50 + internalPower(internal, circuit_current), 1e-9, "budget");
});

test("course problem Q3: 100 W needs R ≈ 1.30 Ω or 0.21 Ω", () => {
    const internal = internalFromPower(16, 4, 50);
    const roots = loadForPower(16, internal, 100);
    assert.ok(roots !== null, "100 W is below P_max");
    assertClose(roots.high, 1.296, 2e-3, "high root");
    assertClose(roots.low, 0.213, 2e-2, "low root");
    for (const load of [roots.low, roots.high]) {
        assertClose(loadPower(load, current(16, internal, load)), 100, 1e-9, `P(R = ${load}) = 100 W`);
    }
});

test("course problem Q4: maximum power at R = r with P_max ≈ 121.8 W", () => {
    const internal = internalFromPower(16, 4, 50);
    assertClose(maxLoadPower(16, internal), 121.79, 0.01, "P_max = E²/(4r)");
    assertClose(
        loadPower(internal, current(16, internal, internal)),
        maxLoadPower(16, internal),
        1e-12,
        "reached exactly at R = r",
    );
});

test("loadForPower degenerates at P_max and rejects impossible powers", () => {
    const matched = loadForPower(12, 2, 18);
    assertClose(matched.low, 2, 1e-6, "double root at R = r");
    assertClose(matched.high, 2, 1e-6, "double root at R = r");
    assert.equal(loadForPower(12, 2, 19), null, "above P_max is impossible");
});
