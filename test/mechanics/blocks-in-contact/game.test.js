/*
 * game.test.js — Unit tests for the save-the-egg game logic: challenge
 * generation bounds, Monte-Carlo feasibility (a slider-grid force wins for at
 * least one block order), the minimum-force math, finish-line interpolation
 * and the egg-break rule. game.js exits before any DOM access under Node, so a
 * side-effect import (after calcul.js, which it reads) only exposes
 * globalThis.blocks_contact_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/blocks-in-contact/calcul.js";
import "../../../src/mechanics/blocks-in-contact/game.js";

const calc = globalThis.blocks_contact_calcul;
const {
    minimumForce,
    contactAt,
    orderIsWinnable,
    isSituationFeasible,
    randomChallenge,
    crossingTime,
    eggBreaks,
    MILESTONES,
    FORCE_STEP,
    FORCE_MAX,
} = globalThis.blocks_contact_game;

test("minimumForce reaches the finish line exactly at the time limit", () => {
    const challenge = { mass_a: 2, mass_b: 3, distance: 10, time_limit: 3, egg_limit: 6.5 };
    const force = minimumForce(challenge);
    const acceleration = calc.accelerationModule(force, 2, 3);
    const arrival = calc.travelTime(10, acceleration);
    assert.ok(Math.abs(arrival - 3) < 1e-12, `expected 3 s, got ${arrival}`);
});

test("the fallback mission is winnable only with the light block in front", () => {
    const challenge = { mass_a: 2, mass_b: 3, distance: 10, time_limit: 3, egg_limit: 6.5 };
    assert.equal(orderIsWinnable(challenge, 2), true, "light block (A) in front works");
    assert.equal(orderIsWinnable(challenge, 3), false, "heavy block (B) in front crushes the egg");
    assert.equal(isSituationFeasible(challenge), true, "the mission is feasible");
});

test("randomChallenge stays within its documented bounds", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        assert.ok(challenge.mass_a >= 0.5 && challenge.mass_a <= 8, "mass A range");
        assert.ok(challenge.mass_b >= 0.5 && challenge.mass_b <= 8, "mass B range");
        assert.notEqual(challenge.mass_a, challenge.mass_b, "different masses so the order matters");
        assert.ok(challenge.distance >= 6 && challenge.distance <= 12, "distance range");
        assert.ok(challenge.time_limit >= 2 && challenge.time_limit <= 5, "time limit range");
        assert.ok(challenge.egg_limit > 0, "positive egg limit");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isSituationFeasible(challenge), true, JSON.stringify(challenge));
    }
});

test("the winning grid force respects both the clock and the egg (Monte-Carlo)", () => {
    for (let i = 0; i < 200; i++) {
        const challenge = randomChallenge(Math.random);
        const grid_force = Math.ceil(minimumForce(challenge) / FORCE_STEP - 1e-9) * FORCE_STEP;
        assert.ok(grid_force <= FORCE_MAX, "the winning force fits the slider");
        const light_mass = Math.min(challenge.mass_a, challenge.mass_b);
        const winnable_light = orderIsWinnable(challenge, light_mass);
        assert.equal(winnable_light, true, "light front always wins at the grid force");
        assert.ok(
            !winnable_light || contactAt(challenge, grid_force, light_mass) <= challenge.egg_limit + 1e-9,
            "the egg survives at the winning force",
        );
        const acceleration = calc.accelerationModule(grid_force, challenge.mass_a, challenge.mass_b);
        assert.ok(
            calc.travelTime(challenge.distance, acceleration) <= challenge.time_limit + 1e-9,
            "the line is crossed in time",
        );
    }
});

test("isSituationFeasible rejects out-of-range or impossible missions", () => {
    const base = { mass_a: 2, mass_b: 3, distance: 10, time_limit: 3, egg_limit: 6.5 };
    assert.equal(isSituationFeasible({ ...base, mass_a: 0.1 }), false, "mass out of range");
    assert.equal(isSituationFeasible({ ...base, distance: 20 }), false, "distance out of range");
    assert.equal(isSituationFeasible({ ...base, egg_limit: 0.1 }), false, "egg too fragile for any order");
    assert.equal(isSituationFeasible({ ...base, time_limit: 1 }), false, "time limit out of range");
});

test("crossingTime interpolates the finish instant", () => {
    const previous_state = { time: 1, displacement: 8 };
    const state = { time: 2, displacement: 12 };
    assert.equal(crossingTime(previous_state, state, 10), 1.5, "midway crossing");
    assert.equal(crossingTime(previous_state, state, 14), null, "not crossed yet");
    assert.equal(crossingTime({ time: 3, displacement: 12 }, { time: 4, displacement: 14 }, 10), null, "already past");
});

test("eggBreaks compares the contact force to the limit", () => {
    assert.equal(eggBreaks(6.5, 6.5), false, "exactly at the limit survives");
    assert.equal(eggBreaks(6.6, 6.5), true, "above the limit breaks");
    assert.equal(eggBreaks(0, 6.5), false, "no force, no omelet");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
