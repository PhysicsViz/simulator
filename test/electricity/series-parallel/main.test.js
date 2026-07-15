/*
 * main.test.js — Unit tests for the series-parallel physics (calcul.js):
 * equivalent resistances, the mesh law (series voltages add up to V), the
 * node law (parallel currents add up), the R_série ≥ max / R_parallèle ≤ min
 * inequalities and the per-resistor powers of the three classic layouts.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electricity/series-parallel/calcul.js";

const {
    seriesResistance,
    parallelResistance,
    currentFromVoltage,
    seriesVoltages,
    parallelCurrents,
    power,
    chainPowers,
    parallelPowers,
    mixedPowers,
} = globalThis.series_parallel_calcul;

/* assertClose: absolute-tolerance numeric comparison */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

test("seriesResistance adds the resistances", () => {
    assert.equal(seriesResistance([10, 20]), 30);
    assert.equal(seriesResistance([10, 20, 30]), 60);
});

test("parallelResistance combines the inverses", () => {
    assertClose(parallelResistance([10, 10]), 5, 1e-12, "two equal resistors halve");
    assertClose(parallelResistance([10, 20, 30]), 60 / 11, 1e-12, "course-style trio");
});

test("R_série ≥ max(R_k) and R_parallèle ≤ min(R_k)", () => {
    for (const resistances of [[10, 20, 30], [5, 47, 22], [1, 100]]) {
        assert.ok(seriesResistance(resistances) >= Math.max(...resistances), "series bound");
        assert.ok(parallelResistance(resistances) <= Math.min(...resistances), "parallel bound");
    }
});

test("mesh law: the series voltages add up to V", () => {
    const voltages = seriesVoltages(9, [10, 20, 30]);
    assertClose(voltages[0], 1.5, 1e-12, "U1 = R1·I");
    assertClose(voltages[1], 3, 1e-12, "U2 = R2·I");
    assertClose(voltages[2], 4.5, 1e-12, "U3 = R3·I");
    assertClose(voltages.reduce((sum, value) => sum + value, 0), 9, 1e-12, "ΣU = V");
});

test("node law: the parallel currents add up to V/R_eq", () => {
    const currents = parallelCurrents(9, [10, 20, 30]);
    assertClose(currents[0], 0.9, 1e-12, "I1 = V/R1");
    const total = currents.reduce((sum, value) => sum + value, 0);
    assertClose(total, currentFromVoltage(9, parallelResistance([10, 20, 30])), 1e-12, "ΣI = V/R_eq");
});

test("power is P = U·I", () => {
    assertClose(power(9, 2), 18, 1e-12, "9 V × 2 A");
});

test("chainPowers: in series the largest resistance glows brightest", () => {
    const powers = chainPowers(9, [5, 22, 47]);
    assert.ok(powers[2] > powers[1] && powers[1] > powers[0], "P grows with R in series");
    const current = 9 / 74;
    assertClose(powers[0], 5 * current * current, 1e-12, "P = R·I²");
});

test("parallelPowers: in parallel the smallest resistance glows brightest", () => {
    const powers = parallelPowers(9, [5, 22, 47]);
    assert.ok(powers[0] > powers[1] && powers[1] > powers[2], "P shrinks with R in parallel");
    assertClose(powers[0], 81 / 5, 1e-12, "P = V²/R");
});

test("mixedPowers: the lone identical bulb is four times brighter than each pair bulb", () => {
    const powers = mixedPowers(9, [10, 10, 10]);
    assertClose(powers[0], 3.6, 1e-12, "P alone = R·(V/(1.5R))²");
    assertClose(powers[1], 0.9, 1e-12, "P pair");
    assertClose(powers[2], 0.9, 1e-12, "P pair");
    assertClose(powers[0] / powers[1], 4, 1e-12, "4× ratio");
});

test("mixedPowers conserves the total power V·I", () => {
    const powers = mixedPowers(9, [10, 22, 47]);
    const total_resistance = 10 + 1 / (1 / 22 + 1 / 47);
    const total = powers.reduce((sum, value) => sum + value, 0);
    assertClose(total, 81 / total_resistance, 1e-12, "ΣP = V²/R_eq");
});
