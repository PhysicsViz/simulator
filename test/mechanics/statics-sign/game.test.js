/*
 * game.test.js — Unit tests for the hang-the-sign game logic: the cable/pivot
 * trade-off, challenge generation bounds, Monte-Carlo solvability and the
 * validity check. game.js exits before any DOM access under Node, so a
 * side-effect import only exposes globalThis.statics_game (after loading
 * calcul.js, which it uses).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/statics-sign/calcul.js";
import "../../../src/mechanics/statics-sign/game.js";

const {
    attemptResult,
    isAttemptValid,
    isChallengeFeasible,
    randomChallenge,
    MILESTONES,
    POSITION_MIN,
    POSITION_MAX,
} = globalThis.statics_game;

test("the trade-off is real: sliding the sign moves load between cable and pivot", () => {
    // the |R| trade-off holds at shallow cable angles (at steep angles the
    // horizontal component T·sin θ dominates and both loads rise toward the tip)
    const challenge = { sign_mass: 4, angle_degrees: 25, tension_max: 1e9, pivot_max: 1e9 };
    const near_pivot = attemptResult(0.2, challenge);
    const near_tip = attemptResult(1.0, challenge);
    assert.ok(near_tip.tension > near_pivot.tension, "cable loads up toward the tip");
    assert.ok(near_pivot.pivot > near_tip.pivot, "pivot loads up toward the pivot");
});

test("every generated challenge is solvable and reasonably tight (Monte-Carlo)", () => {
    for (let i = 0; i < 400; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isChallengeFeasible(challenge), true, JSON.stringify(challenge));
        assert.ok(challenge.sign_mass >= 2 && challenge.sign_mass <= 6, "mass range");
        assert.ok(challenge.angle_degrees >= 35 && challenge.angle_degrees <= 65, "angle range");
        // not trivially solvable everywhere: at least one end of the range must fail
        const fails_somewhere = !isAttemptValid(POSITION_MIN, challenge) || !isAttemptValid(POSITION_MAX, challenge);
        assert.equal(fails_somewhere, true, `challenge too loose: ${JSON.stringify(challenge)}`);
    }
});

test("isAttemptValid rejects both failure modes", () => {
    const challenge = { sign_mass: 4, angle_degrees: 60, tension_max: 60, pivot_max: 70 };
    const tight_cable = { ...challenge, tension_max: attemptResult(0.9, challenge).tension - 1 };
    assert.equal(isAttemptValid(0.9, tight_cable), false, "cable rating exceeded");
    const tight_pivot = { ...challenge, pivot_max: attemptResult(0.15, challenge).pivot - 1 };
    assert.equal(isAttemptValid(0.15, tight_pivot), false, "pivot rating exceeded");
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
