/*
 * main.test.js — Unit tests for the RC-circuit physics (calcul.js): the time
 * constant τ = R·C, the exact charge/discharge exponentials, the 63/37 % rule
 * at t = τ, the mesh law, the energies (including the famous half-energy law,
 * independent of R) and the trigger-time inversion.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electricity/rc-circuit/calcul.js";

const {
    timeConstant,
    chargeVoltage,
    dischargeVoltage,
    chargeCurrent,
    dischargeCurrent,
    capacitorCharge,
    storedEnergy,
    suppliedEnergy,
    dissipatedEnergy,
    triggerTime,
} = globalThis.rc_circuit_calcul;

const EMF = 9;
const RESISTANCE = 10000;
const CAPACITANCE = 100e-6;
const TAU = timeConstant(RESISTANCE, CAPACITANCE);

/* assertClose: relative-tolerance numeric comparison */
function assertClose(actual, expected, relative_tolerance, message) {
    const scale = Math.max(Math.abs(expected), 1e-30);
    assert.ok(
        Math.abs(actual - expected) / scale < relative_tolerance,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("τ = R·C: 10 kΩ × 100 µF = 1 s (ohms × farads = seconds)", () => {
    assertClose(TAU, 1, 1e-12, "time constant");
});

test("the 63.2 / 36.8 % rule at t = τ", () => {
    assertClose(chargeVoltage(EMF, TAU, TAU), EMF * (1 - Math.exp(-1)), 1e-12, "charging: 63.2 % of E");
    assertClose(dischargeVoltage(EMF, TAU, TAU), EMF * Math.exp(-1), 1e-12, "discharging: 36.8 % of E");
    assertClose(chargeVoltage(EMF, TAU, TAU) / EMF, 0.632, 1e-3, "≈ 63.2 %");
});

test("boundaries: empty at t = 0 while charging, 99.3 % settled at 5τ", () => {
    assert.equal(chargeVoltage(EMF, TAU, 0), 0, "u_C(0) = 0");
    assertClose(chargeCurrent(EMF, RESISTANCE, TAU, 0), EMF / RESISTANCE, 1e-12, "i(0) = E/R");
    assertClose(chargeVoltage(EMF, TAU, 5 * TAU) / EMF, 0.9933, 1e-3, "99.3 % at 5τ");
});

test("the mesh law E = R·i + u_C holds at every instant while charging", () => {
    for (const time of [0, 0.3, 1, 2.7, 5]) {
        assertClose(
            RESISTANCE * chargeCurrent(EMF, RESISTANCE, TAU, time) + chargeVoltage(EMF, TAU, time),
            EMF,
            1e-12,
            `mesh law at t = ${time}`,
        );
    }
});

test("discharging: u_C = −R·i at every instant (the capacitor drives R)", () => {
    for (const time of [0, 0.5, 1.8]) {
        assertClose(
            dischargeVoltage(EMF, TAU, time),
            -RESISTANCE * dischargeCurrent(EMF, RESISTANCE, TAU, time),
            1e-12,
            `u_C = u_R at t = ${time}`,
        );
    }
    assert.ok(dischargeCurrent(EMF, RESISTANCE, TAU, 1) < 0, "the current reverses");
});

test("q = C·u and the stored energy ½·C·u²", () => {
    const voltage = chargeVoltage(EMF, TAU, 1);
    assertClose(capacitorCharge(CAPACITANCE, voltage), CAPACITANCE * voltage, 1e-12, "q = C·u");
    assertClose(storedEnergy(CAPACITANCE, EMF), 0.5 * CAPACITANCE * 81, 1e-12, "½CE² fully charged");
});

test("the half-energy law: half the supplied energy heats R, whatever R", () => {
    for (const resistance of [100, 10000, 5e6]) {
        const tau = timeConstant(resistance, CAPACITANCE);
        const voltage = chargeVoltage(EMF, tau, 40 * tau);
        const supplied = suppliedEnergy(EMF, CAPACITANCE, voltage);
        const dissipated = dissipatedEnergy(EMF, CAPACITANCE, voltage, false);
        assertClose(supplied, CAPACITANCE * EMF * EMF, 1e-9, `supplied → C·E² for R = ${resistance}`);
        assertClose(dissipated / supplied, 0.5, 1e-6, `half dissipated for R = ${resistance}`);
    }
});

test("dissipated energy matches the closed form ½·C·E²·(1 − e^(−2t/τ)) while charging", () => {
    for (const time of [0.2, 1, 3]) {
        const voltage = chargeVoltage(EMF, TAU, time);
        assertClose(
            dissipatedEnergy(EMF, CAPACITANCE, voltage, false),
            0.5 * CAPACITANCE * EMF * EMF * (1 - Math.exp(-2 * time / TAU)),
            1e-12,
            `Joule heat at t = ${time}`,
        );
    }
});

test("triggerTime inverts the charge law and rejects unreachable thresholds", () => {
    const threshold = 5.7;
    const trigger = triggerTime(EMF, TAU, threshold);
    assertClose(chargeVoltage(EMF, TAU, trigger), threshold, 1e-12, "u_C(t_trigger) = u_s");
    assertClose(trigger, Math.log(EMF / (EMF - threshold)), 1e-12, "t = τ·ln(E/(E−u_s)) with τ = 1");
    assert.equal(triggerTime(EMF, TAU, 9), Infinity, "u_s = E is never reached");
    assert.equal(triggerTime(EMF, TAU, 12), Infinity, "u_s > E is never reached");
});
