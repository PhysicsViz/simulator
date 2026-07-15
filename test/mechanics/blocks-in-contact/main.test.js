/*
 * main.test.js — Unit tests for the blocks-in-contact physics (calcul.js):
 * the course's four numeric answers (a = 4 m/s², contact force 8 N, net force
 * on the pushed block 12 N, contact force 12 N with the blocks swapped for
 * mA = 2 kg, mB = 3 kg, F = 20 N), Newton's third-law identities, vertical
 * equilibrium and the MRUA kinematics.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/blocks-in-contact/calcul.js";

const {
    accelerationModule,
    contactForceModule,
    netForceModule,
    normalForce,
    positionAt,
    velocityAt,
    travelTime,
} = globalThis.blocks_contact_calcul;

/* assertClose: absolute-tolerance numeric comparison */
function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, got ${actual}`);
}

test("question 1: a = F/(mA + mB) = 4 m/s²", () => {
    assertClose(accelerationModule(20, 2, 3), 4, 1e-12, "20/(2+3)");
});

test("question 2: the front block A feels a contact force of 8 N", () => {
    assertClose(contactForceModule(20, 2, 2, 3), 8, 1e-12, "F contact = mA·a");
});

test("question 3: the net force on the pushed block B is 12 N", () => {
    const acceleration = accelerationModule(20, 2, 3);
    assertClose(netForceModule(3, acceleration), 12, 1e-12, "ΣF_B = mB·a");
    assertClose(20 - contactForceModule(20, 2, 2, 3), 12, 1e-12, "ΣF_B = F − F contact");
});

test("question 4: with the blocks swapped the contact force becomes 12 N", () => {
    assertClose(contactForceModule(20, 3, 2, 3), 12, 1e-12, "F contact = mB·a");
});

test("the two contact forces of the two orders sum to F", () => {
    for (const [force, mass_a, mass_b] of [[20, 2, 3], [50, 1, 7], [12.5, 4.4, 0.6]]) {
        const sum = contactForceModule(force, mass_a, mass_a, mass_b)
            + contactForceModule(force, mass_b, mass_a, mass_b);
        assertClose(sum, force, 1e-12, "mA·a + mB·a = F");
    }
});

test("the lighter front block always gives the smaller contact force", () => {
    assert.ok(
        contactForceModule(20, 2, 2, 3) < contactForceModule(20, 3, 2, 3),
        "front mass 2 kg beats front mass 3 kg",
    );
});

test("vertical equilibrium: N = m·g", () => {
    assertClose(normalForce(2, 9.81), 19.62, 1e-12, "N_A");
    assertClose(normalForce(3, 9.81), 29.43, 1e-12, "N_B");
});

test("MRUA kinematics from rest", () => {
    assertClose(positionAt(4, 2), 8, 1e-12, "x = a·t²/2");
    assertClose(velocityAt(4, 2), 8, 1e-12, "v = a·t");
    assertClose(positionAt(0, 5), 0, 1e-12, "no force, no motion");
});

test("travelTime covers the distance exactly and handles a = 0", () => {
    const time = travelTime(15, 4);
    assertClose(positionAt(4, time), 15, 1e-12, "x(travelTime) = D");
    assert.equal(travelTime(15, 0), Infinity, "never with a = 0");
});
