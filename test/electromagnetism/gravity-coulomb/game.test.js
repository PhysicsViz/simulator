/*
 * game.test.js — Unit tests for the space-docking game logic: challenge
 * generation bounds, Monte-Carlo feasibility (a slider-grid charge always
 * docks below the speed limit within the mission window), the charge window
 * math, and outcome classification. game.js exits before any DOM access under
 * Node, so a side-effect import (after calcul.js, which it reads) only exposes
 * globalThis.gravity_coulomb_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/electromagnetism/gravity-coulomb/calcul.js";
import "../../../src/electromagnetism/gravity-coulomb/game.js";

const calc = globalThis.gravity_coulomb_calcul;
const {
    dockingSpeed,
    missionWindow,
    chargeWindow,
    isSituationFeasible,
    randomChallenge,
    dockingOutcome,
    MILESTONES,
    CONTACT_DISTANCE,
    WINDOW_FACTOR,
    CHARGE_STEP,
} = globalThis.gravity_coulomb_game;

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.mass >= 200 && challenge.mass <= 5000, "mass range");
        assert.ok(challenge.initial_distance >= 6 && challenge.initial_distance <= 30, "distance range");
        const free_fall_speed = dockingSpeed(challenge.mass, 0, challenge.initial_distance);
        assert.ok(
            challenge.max_docking_speed > 0 && challenge.max_docking_speed <= 0.6 * free_fall_speed + 1e-15,
            "speed limit range",
        );
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("a slider-grid charge inside the window actually docks (Monte-Carlo)", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        const window = chargeWindow(challenge);
        const grid_charge = Math.ceil(window.min_charge / CHARGE_STEP - 1e-9) * CHARGE_STEP;
        assert.ok(grid_charge <= window.max_charge, "a grid point exists in the window");
        const contact_speed = dockingSpeed(challenge.mass, grid_charge, challenge.initial_distance);
        assert.ok(contact_speed <= challenge.max_docking_speed, "docks below the speed limit");
        const mu = calc.relativeMu(challenge.mass, grid_charge, true);
        assert.ok(
            calc.contactTime(challenge.initial_distance, mu, CONTACT_DISTANCE)
                <= missionWindow(challenge.mass, challenge.initial_distance) + 1e-9,
            "docks within the mission window",
        );
    }
});

test("chargeWindow brackets the equilibrium charge from below", () => {
    const challenge = { mass: 1000, initial_distance: 10, max_docking_speed: 0.45 * dockingSpeed(1000, 0, 10) };
    const window = chargeWindow(challenge);
    const equilibrium = calc.equilibriumCharge(1000);
    assert.ok(window.min_charge > 0.8 * equilibrium, "soft docking needs q close to q_eq");
    assert.ok(window.max_charge < equilibrium, "q must stay below q_eq to dock at all");
    assert.ok(window.min_charge < window.max_charge, "non-empty window");
    assert.equal(
        window.max_charge,
        equilibrium * Math.sqrt(1 - 1 / (WINDOW_FACTOR * WINDOW_FACTOR)),
        "window bound comes from t_contact ∝ 1/√C",
    );
});

test("isSituationFeasible rejects out-of-range or impossible missions", () => {
    const speed = 0.45 * dockingSpeed(1000, 0, 10);
    assert.equal(isSituationFeasible({ mass: 50, initial_distance: 10, max_docking_speed: speed }), false, "mass too small");
    assert.equal(isSituationFeasible({ mass: 1000, initial_distance: 50, max_docking_speed: speed }), false, "too far");
    assert.equal(isSituationFeasible({ mass: 1000, initial_distance: 10, max_docking_speed: 0 }), false, "zero speed limit");
    assert.equal(isSituationFeasible({ mass: 1000, initial_distance: 10, max_docking_speed: -1 }), false, "negative limit");
});

test("dockingOutcome classifies contact speeds against the limit", () => {
    assert.equal(dockingOutcome(1e-6, 2e-6), "docked");
    assert.equal(dockingOutcome(3e-6, 2e-6), "crashed");
    assert.equal(dockingOutcome(2e-6, 2e-6), "docked", "exactly at the limit still docks");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
