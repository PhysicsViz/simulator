/*
 * main.test.js — Unit tests for the circuit solver (calcul.js): linear system,
 * Ohm's law, series/parallel resistances, switches, source power and RC
 * charging against the analytic exponential.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electricity/dc-circuit/calcul.js";

const { solveLinearSystem, solveCircuit, simulate } = globalThis.circuit_calcul;

/* assertClose: numeric comparison within a relative tolerance */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-12);
    assert.ok(
        Math.abs(actual - expected) <= relative_tolerance * scale,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

/* component: shorthand test factory */
let counter = 0;
function component(type, a, b, value = 0, closed = true) {
    counter += 1;
    return { id: `t${counter}`, type, nodes: [a, b], value, closed };
}

test("solveLinearSystem solves a 2×2 system", () => {
    const solution = solveLinearSystem([[2, 1], [1, 3]], [5, 10]);
    assertClose(solution[0], 1, 1e-12, "x");
    assertClose(solution[1], 3, 1e-12, "y");
});

test("single resistor obeys Ohm's law", () => {
    const source = component("source", "a", "b", 9);
    const resistor = component("resistor", "a", "b", 10);
    const solved = solveCircuit([source, resistor], 1 / 240);
    assertClose(solved.branches.get(resistor.id).current, 0.9, 1e-3, "I = U/R");
    assertClose(Math.abs(solved.branches.get(resistor.id).power), 8.1, 1e-3, "P = U²/R");
});

test("series resistors divide the voltage", () => {
    const source = component("source", "a", "c", 9);
    const r1 = component("resistor", "a", "b", 10);
    const r2 = component("resistor", "b", "c", 20);
    const solved = solveCircuit([source, r1, r2], 1 / 240);
    assertClose(solved.branches.get(r1.id).current, 0.3, 1e-3, "I = U/(R1+R2)");
    assertClose(Math.abs(solved.branches.get(r2.id).voltage), 6, 1e-3, "U2 = R2·I");
});

test("parallel resistors add their conductances", () => {
    const source = component("source", "a", "b", 9);
    const r1 = component("resistor", "a", "b", 10);
    const r2 = component("resistor", "a", "b", 10);
    const solved = solveCircuit([source, r1, r2], 1 / 240);
    assertClose(Math.abs(solved.branches.get(source.id).current), 1.8, 1e-3, "I = U/(R∥R)");
});

test("an open switch cuts the current, a closed one conducts", () => {
    const source = component("source", "a", "c", 9);
    const open_switch = component("switch", "a", "b", 0, false);
    const resistor = component("resistor", "b", "c", 10);
    const open_solved = solveCircuit([source, open_switch, resistor], 1 / 240);
    assert.ok(Math.abs(open_solved.branches.get(resistor.id).current) < 1e-6, "open (only the leak current remains)");
    open_switch.closed = true;
    const closed_solved = solveCircuit([source, open_switch, resistor], 1 / 240);
    assertClose(closed_solved.branches.get(resistor.id).current, 0.9, 1e-3, "closed");
});

test("source power equals the dissipated power", () => {
    const source = component("source", "a", "b", 12);
    const resistor = component("resistor", "a", "b", 24);
    const solved = solveCircuit([source, resistor], 1 / 240);
    assertClose(
        Math.abs(solved.branches.get(source.id).power),
        Math.abs(solved.branches.get(resistor.id).power),
        1e-6,
        "energy conservation",
    );
});

test("ammeter reads the loop current without disturbing it", () => {
    const source = component("source", "a", "c", 9);
    const ammeter = component("ammeter", "a", "b");
    const resistor = component("resistor", "b", "c", 10);
    const solved = solveCircuit([source, ammeter, resistor], 1 / 240);
    assertClose(solved.branches.get(ammeter.id).current, 0.9, 1e-3, "ammeter current");
});

test("RC charging follows U_C = U·(1 − e^(−t/RC)) within 1%", () => {
    const source = component("source", "a", "c", 9);
    const resistor = component("resistor", "a", "b", 10);
    const capacitor = component("capacitor", "b", "c", 0.1);
    const dt = 1 / 240;
    const frames = simulate([source, resistor, capacitor], dt, 480);
    const capacitor_voltage = Math.abs(frames[480].branches.get(capacitor.id).voltage);
    const expected = 9 * (1 - Math.exp(-2 / (10 * 0.1)));
    assertClose(capacitor_voltage, expected, 0.01, "U_C after 2 s (tau = 1 s)");
    const initial_current = Math.abs(frames[1].branches.get(resistor.id).current);
    assertClose(initial_current, 0.9, 0.05, "initial current ≈ U/R");
});

test("a floating sub-circuit does not break the solver", () => {
    const source = component("source", "a", "b", 9);
    const resistor = component("resistor", "a", "b", 10);
    const floating = component("resistor", "x", "y", 10);
    const solved = solveCircuit([source, resistor, floating], 1 / 240);
    assertClose(solved.branches.get(resistor.id).current, 0.9, 1e-3, "main loop unaffected");
    assertClose(solved.branches.get(floating.id).current, 0, 1e-6, "floating branch dead");
});
