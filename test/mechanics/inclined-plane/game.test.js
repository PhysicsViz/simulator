/*
 * game.test.js — Unit tests for the slope-challenge game logic: challenge
 * generation bounds, Monte-Carlo solvability within the input ranges, checker
 * negatives and the speed window. game.js exits before any DOM access under
 * Node, so a side-effect import only exposes globalThis.incline_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/inclined-plane/game.js";

const {
    randomChallenge,
    isChallengeFeasible,
    speedWindow,
    MILESTONES,
    GRAVITY,
    STOP_TOLERANCE,
} = globalThis.incline_game;

test("every generated challenge is solvable (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isChallengeFeasible(challenge), true, JSON.stringify(challenge));
        assert.ok(challenge.angle_degrees >= 10 && challenge.angle_degrees <= 35, "angle range");
        assert.ok(challenge.target_position >= 2 && challenge.target_position <= 6, "target range");
        if (challenge.type === "stop") {
            // the winning pair exists: μ = tan α holds the block, v0 = √(4·g·sinα·s*) ≤ 10
            const angle = challenge.angle_degrees * Math.PI / 180;
            const v0 = Math.sqrt(4 * GRAVITY * Math.sin(angle) * challenge.target_position);
            assert.ok(v0 <= 10, `needed v0 ${v0}`);
            assert.ok(Math.tan(angle) <= 1.5, "holding μ within range");
        }
    }
});

test("isChallengeFeasible rejects out-of-range demands", () => {
    assert.equal(
        isChallengeFeasible({ type: "stop", angle_degrees: 60, target_position: 5 }),
        false,
        "needed v0 too large / slope too steep to reach far targets",
    );
    assert.equal(
        isChallengeFeasible({ type: "speed", angle_degrees: 30, target_position: 6, target_speed: 8 }),
        false,
        "needed v0 above the input maximum",
    );
    assert.equal(
        isChallengeFeasible({ type: "stop", angle_degrees: 20, target_position: 0.1 }),
        false,
        "target inside the tolerance of the start",
    );
});

test("speedWindow is 15% with a 0.3 m/s floor", () => {
    assert.ok(Math.abs(speedWindow(4) - 0.6) < 1e-12, "15% of 4");
    assert.ok(Math.abs(speedWindow(1) - 0.3) < 1e-12, "floor");
});

test("stop tolerance and milestones are the documented ones", () => {
    assert.equal(STOP_TOLERANCE, 0.3);
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
