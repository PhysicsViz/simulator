/*
 * game.test.js — Unit tests for the bucket game logic: challenge generation
 * bounds, Monte-Carlo feasibility (a winning speed window always exists inside
 * the input range) and the feasibility checker's negatives. game.js exits
 * before any DOM access under Node, so a side-effect import only exposes
 * globalThis.circular_motion_game.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../../src/mechanics/uniform-circular-motion/game.js";

const {
    randomChallenge,
    isChallengeFeasible,
    MILESTONES,
    GRAVITY,
    SPEED_MIN,
    SPEED_MAX,
} = globalThis.circular_motion_game;

test("randomChallenge stays within its documented bounds, aligned to the input step", () => {
    for (const seed of [0, 0.5, 0.999999]) {
        const challenge = randomChallenge(() => seed);
        assert.ok(challenge.radius >= 0.5 - 1e-9 && challenge.radius <= 1.3 + 1e-9, `radius ${challenge.radius}`);
        assert.ok(challenge.mass >= 0.5 - 1e-9 && challenge.mass <= 1.5 + 1e-9, `mass ${challenge.mass}`);
        assert.ok(Math.abs(challenge.radius * 10 - Math.round(challenge.radius * 10)) < 1e-9, "radius on 0.1 grid");
        assert.ok(Math.abs(challenge.mass * 10 - Math.round(challenge.mass * 10)) < 1e-9, "mass on 0.1 grid");
    }
});

test("every generated challenge is feasible (Monte-Carlo)", () => {
    for (let i = 0; i < 500; i++) {
        const challenge = randomChallenge(Math.random);
        assert.equal(isChallengeFeasible(challenge), true, JSON.stringify(challenge));
        // the window is the documented one: sqrt(g·R) up to the tension limit
        const minimum_speed = Math.sqrt(GRAVITY * challenge.radius);
        const maximum_speed = Math.sqrt((challenge.tension_max / challenge.mass - GRAVITY) * challenge.radius);
        assert.ok(minimum_speed >= SPEED_MIN && minimum_speed <= SPEED_MAX, "v_min in range");
        assert.ok(maximum_speed > minimum_speed, "window is open");
    }
});

test("isChallengeFeasible rejects an impossible tension limit", () => {
    assert.equal(isChallengeFeasible({ radius: 0.8, mass: 1, tension_max: 5 }), false, "T_max < m·g leaves no speed");
    assert.equal(
        isChallengeFeasible({ radius: 0.8, mass: 1, tension_max: 2 * GRAVITY * 1.01 }),
        false,
        "window narrower than 10%",
    );
});

test("milestones are shared across game modes", () => {
    assert.deepEqual(MILESTONES, [1, 5, 10, 20, 40, 70, 100]);
});
